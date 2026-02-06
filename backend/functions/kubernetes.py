"""
Kubernetes-based function execution manager

Replaces FirecrackerManager with Kubernetes pods for function execution.
"""

import logging
import time
import subprocess
from typing import Dict, List, Optional
import requests
from kubernetes import client, config
from kubernetes.client.rest import ApiException
from django.conf import settings

logger = logging.getLogger(__name__)


# Runtime to Docker image mapping
RUNTIME_IMAGES = {
    # Python
    "python3.9": "fnbox-python:3.9",
    "python3.10": "fnbox-python:3.10",
    "python3.11": "fnbox-python:3.11",
    "python3.12": "fnbox-python:3.12",
    "python3.13": "fnbox-python:3.13",
    "python3.14": "fnbox-python:3.14",

    # Node.js
    "nodejs20": "fnbox-nodejs:20",
    "nodejs24": "fnbox-nodejs:24",
    "nodejs25": "fnbox-nodejs:25",

    # Ruby
    "ruby3.4": "fnbox-ruby:3.4",

    # Java
    "java27": "fnbox-java:27",

    # .NET
    "dotnet8": "fnbox-dotnet:8",
    "dotnet9": "fnbox-dotnet:9",
    "dotnet10": "fnbox-dotnet:10",

    # Bash
    "bash5": "fnbox-bash:5",

    # Go
    "go1.25": "fnbox-go:1.25",
}


class KubernetesManager:
    """Manages function execution on Kubernetes"""

    def __init__(self):
        self.namespace = getattr(settings, 'KUBERNETES_NAMESPACE', 'fnbox-functions')
        self.in_cluster = self._load_config()
        self.apps_v1 = client.AppsV1Api()
        self.core_v1 = client.CoreV1Api()
        self.autoscaling_v2 = client.AutoscalingV2Api()

    def _load_config(self):
        """Load Kubernetes configuration and return if running in-cluster"""
        try:
            # Try in-cluster config first (when running inside K8s)
            config.load_incluster_config()
            logger.info("Loaded in-cluster Kubernetes config")
            return True
        except:
            # Fall back to local kubeconfig (for development)
            try:
                config.load_kube_config()
                logger.info("Loaded local Kubernetes config")
                return False
            except Exception as e:
                logger.error(f"Failed to load Kubernetes config: {e}")
                raise

    @classmethod
    def initialize(cls):
        """Initialize Kubernetes environment (create namespace if needed)"""
        try:
            manager = cls()

            # Create namespace if it doesn't exist
            try:
                manager.core_v1.read_namespace(name=manager.namespace)
                logger.info(f"Namespace {manager.namespace} already exists")
            except ApiException as e:
                if e.status == 404:
                    namespace = client.V1Namespace(
                        metadata=client.V1ObjectMeta(name=manager.namespace)
                    )
                    manager.core_v1.create_namespace(body=namespace)
                    logger.info(f"Created namespace {manager.namespace}")
                else:
                    raise

            return True
        except Exception as e:
            logger.error(f"Failed to initialize Kubernetes: {e}")
            return False

    def deploy_function(self, function_id: str, runtime: str, code: str,
                       dependencies: List, memory_mb: int, timeout_seconds: int,
                       vcpu_count: int = 1) -> Dict:
        """
        Deploy a function as a Kubernetes Deployment + Service

        Args:
            function_id: UUID of the function
            runtime: Runtime environment (e.g., 'python3.11', 'nodejs20')
            code: Function code
            dependencies: List of dependencies (not used yet, pre-installed in images)
            memory_mb: Memory limit in MB
            timeout_seconds: Execution timeout
            vcpu_count: Number of CPU cores (converted to milli-cores)

        Returns:
            {
                "deployment_name": str,
                "service_name": str,
                "service_ip": str,
                "pod_name": str,
                "status": str
            }
        """
        deployment_name = f"func-{function_id[:8]}"
        service_name = f"{deployment_name}-svc"

        # Get Docker image for runtime
        image = RUNTIME_IMAGES.get(runtime)
        if not image:
            raise ValueError(f"Unsupported runtime: {runtime}")

        logger.info(f"Deploying function {function_id} with runtime {runtime}")
        logger.info(f"Deployment: {deployment_name}, Image: {image}")

        # Create ConfigMap for function code
        self._create_function_configmap(deployment_name, code)

        # Create Deployment
        deployment = self._create_deployment(
            name=deployment_name,
            function_id=function_id,
            image=image,
            memory_mb=memory_mb,
            cpu_millicores=int(float(vcpu_count) * 1000),  # Convert Decimal to millicores
            replicas=1,
            dependencies=dependencies
        )

        # Create Service for load balancing
        service = self._create_service(
            name=service_name,
            deployment_name=deployment_name
        )

        # Create Horizontal Pod Autoscaler for automatic scaling
        self._create_hpa(deployment_name)

        # Calculate dynamic timeout based on number of dependencies
        # Base timeout: 60s, plus 10s per dependency package
        # Max timeout: 300s (5 minutes) to prevent excessive waits
        base_timeout = 60
        per_package_timeout = 10
        calculated_timeout = base_timeout + (len(dependencies) * per_package_timeout)
        deployment_timeout = min(calculated_timeout, 300)

        logger.info(f"Waiting for deployment with {len(dependencies)} dependencies (timeout: {deployment_timeout}s)")

        # Wait for deployment to be ready
        ready = self._wait_for_deployment(deployment_name, timeout=deployment_timeout)

        if not ready:
            raise Exception(f"Deployment {deployment_name} failed to become ready")

        # Get pod name
        pods = self.core_v1.list_namespaced_pod(
            namespace=self.namespace,
            label_selector=f"app={deployment_name}"
        )
        pod_name = pods.items[0].metadata.name if pods.items else None

        return {
            "deployment_name": deployment_name,
            "service_name": service_name,
            "service_ip": service.spec.cluster_ip,
            "pod_name": pod_name,
            "status": "running"
        }

    def invoke_function(self, service_name: str, event: Dict,
                       timeout_seconds: int = 30, code: str = None, handler: str = "handler") -> Dict:
        """
        Invoke a function via its Kubernetes service.
        Works both in-cluster and out-of-cluster (local dev).

        Args:
            service_name: Name of the K8s Service
            event: Event data to pass to function
            timeout_seconds: Execution timeout
            code: Function code (required for execution)
            handler: Handler function name

        Returns:
            {
                "success": bool,
                "result": any,
                "logs": str,
                "execution_time_ms": int,
                "memory_used_mb": int
            }
        """
        port_forward_proc = None  # Initialize to avoid undefined variable

        if self.in_cluster:
            # Production: Use service DNS name
            service_url = f"http://{service_name}.{self.namespace}.svc.cluster.local:8080/invoke"
            logger.info(f"[In-Cluster] Invoking function at {service_url}")
        else:
            # Local dev: Use kubectl port-forward
            import random

            # Use a random local port to avoid conflicts
            local_port = random.randint(30000, 32000)

            logger.info(f"[Local Dev] Port-forwarding {service_name} to localhost:{local_port}")

            # Start port-forward process with DEVNULL to prevent pipe buffer issues
            try:
                port_forward_proc = subprocess.Popen(
                    ['kubectl', 'port-forward', f'service/{service_name}',
                     f'{local_port}:8080', '-n', self.namespace],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )

                # Give it a moment to establish the connection
                import time as time_module
                time_module.sleep(1)

                # Check if process is still running
                if port_forward_proc.poll() is not None:
                    raise Exception("kubectl port-forward process exited unexpectedly")

            except Exception as pf_err:
                logger.error(f"Failed to start port-forward: {pf_err}")
                raise Exception(f"Could not establish port-forward to {service_name}: {pf_err}")

            service_url = f"http://localhost:{local_port}/invoke"
            logger.info(f"[Local Dev] Invoking function at {service_url}")

        # Call the agent
        try:
            # Extract secrets from event (if present) and pass as env vars
            secrets = event.pop('__secrets__', {})

            payload = {
                "event": event,  # Event without __secrets__
                "timeout_seconds": timeout_seconds
            }

            # Include code if provided (for one-shot execution)
            if code:
                payload["code"] = code
                payload["handler"] = handler

                # Pass secrets as environment variables
                if secrets:
                    payload["env_vars"] = secrets
                    logger.info(f"Passing {len(secrets)} secrets as environment variables")

            response = requests.post(
                service_url,
                json=payload,
                timeout=timeout_seconds + 5
            )

            # Log response details for debugging
            logger.info(f"Function response status: {response.status_code}, content-type: {response.headers.get('content-type', 'unknown')}")

            response.raise_for_status()

            # Check if response is actually JSON before parsing
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type:
                logger.error(f"Function returned non-JSON response: content-type={content_type}, body={response.text[:200]}")
                return {
                    "success": False,
                    "error": f"Function returned non-JSON response (content-type: {content_type})",
                    "logs": response.text[:500] if response.text else "",
                    "execution_time_ms": 0,
                    "memory_used_mb": 0
                }

            # Check for empty response
            if not response.text or response.text.strip() == '':
                logger.error("Function returned empty response")
                return {
                    "success": False,
                    "error": "Function returned empty response",
                    "logs": "",
                    "execution_time_ms": 0,
                    "memory_used_mb": 0
                }

            try:
                result = response.json()
            except ValueError as json_err:
                logger.error(f"Failed to parse JSON response: {json_err}, body={response.text[:200]}")
                return {
                    "success": False,
                    "error": f"Failed to parse function response as JSON: {str(json_err)}",
                    "logs": response.text[:500] if response.text else "",
                    "execution_time_ms": 0,
                    "memory_used_mb": 0
                }

            return result

        except requests.exceptions.Timeout:
            logger.error(f"Function invocation timed out after {timeout_seconds} seconds")
            return {
                "success": False,
                "error": f"Function execution exceeded {timeout_seconds} seconds",
                "logs": "",
                "execution_time_ms": timeout_seconds * 1000,
                "memory_used_mb": 0
            }
        except requests.exceptions.ConnectionError as conn_err:
            logger.error(f"Failed to connect to function service: {conn_err}")
            return {
                "success": False,
                "error": f"Failed to connect to function service: {str(conn_err)}",
                "logs": "",
                "execution_time_ms": 0,
                "memory_used_mb": 0
            }
        except requests.exceptions.HTTPError as http_err:
            logger.error(f"Function returned HTTP error: {http_err}, response={http_err.response.text[:200] if http_err.response else 'N/A'}")
            return {
                "success": False,
                "error": f"Function returned HTTP error {http_err.response.status_code if http_err.response else 'unknown'}: {str(http_err)}",
                "logs": http_err.response.text[:500] if http_err.response and http_err.response.text else "",
                "execution_time_ms": 0,
                "memory_used_mb": 0
            }
        except Exception as e:
            logger.error(f"Failed to invoke function: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "logs": "",
                "execution_time_ms": 0,
                "memory_used_mb": 0
            }
        finally:
            # Always cleanup port-forward if we started one
            if port_forward_proc is not None:
                try:
                    # First try graceful termination
                    port_forward_proc.terminate()
                    try:
                        port_forward_proc.wait(timeout=2)
                        logger.info("[Local Dev] Cleaned up port-forward process")
                    except subprocess.TimeoutExpired:
                        logger.warning("[Local Dev] Port-forward didn't terminate gracefully, force killing")
                        port_forward_proc.kill()
                        port_forward_proc.wait(timeout=1)
                        logger.info("[Local Dev] Force killed port-forward process")
                except Exception as cleanup_err:
                    logger.error(f"Failed to cleanup port-forward: {cleanup_err}")
                    # Last resort: force kill
                    try:
                        port_forward_proc.kill()
                        port_forward_proc.wait(timeout=1)
                    except Exception as kill_err:
                        logger.error(f"Failed to force kill port-forward: {kill_err}")
                        # Log the PID so it can be manually cleaned up
                        try:
                            logger.error(f"Orphaned port-forward process PID: {port_forward_proc.pid}")
                        except:
                            pass

    def delete_function(self, deployment_name: str):
        """Delete function deployment, service, HPA, and configmap"""
        service_name = f"{deployment_name}-svc"
        hpa_name = f"{deployment_name}-hpa"

        # Delete HPA first
        try:
            self.autoscaling_v2.delete_namespaced_horizontal_pod_autoscaler(
                name=hpa_name,
                namespace=self.namespace
            )
            logger.info(f"Deleted HPA {hpa_name}")
        except ApiException as e:
            if e.status != 404:
                logger.warning(f"Failed to delete HPA: {e}")

        # Delete Service
        try:
            self.core_v1.delete_namespaced_service(
                name=service_name,
                namespace=self.namespace
            )
            logger.info(f"Deleted service {service_name}")
        except ApiException as e:
            if e.status != 404:
                logger.warning(f"Failed to delete service: {e}")

        # Delete Deployment
        try:
            self.apps_v1.delete_namespaced_deployment(
                name=deployment_name,
                namespace=self.namespace,
                body=client.V1DeleteOptions(
                    propagation_policy='Foreground',
                    grace_period_seconds=5
                )
            )
            logger.info(f"Deleted deployment {deployment_name}")
        except ApiException as e:
            if e.status != 404:
                logger.warning(f"Failed to delete deployment: {e}")

        # Wait for deployment to be fully deleted
        logger.info(f"Waiting for deployment {deployment_name} to be fully deleted...")
        for i in range(30):  # Wait up to 30 seconds
            try:
                self.apps_v1.read_namespaced_deployment(
                    name=deployment_name,
                    namespace=self.namespace
                )
                # Still exists, wait a bit more
                time.sleep(1)
            except ApiException as e:
                if e.status == 404:
                    # Deployment is gone
                    logger.info(f"Deployment {deployment_name} fully deleted")
                    break
        else:
            logger.warning(f"Deployment {deployment_name} still exists after 30s, continuing anyway")

        # Delete ConfigMap
        try:
            self.core_v1.delete_namespaced_config_map(
                name=deployment_name,
                namespace=self.namespace
            )
            logger.info(f"Deleted configmap {deployment_name}")
        except ApiException as e:
            if e.status != 404:
                logger.warning(f"Failed to delete configmap: {e}")

    def get_function_status(self, deployment_name: str) -> Dict:
        """Get status of a function deployment"""
        try:
            deployment = self.apps_v1.read_namespaced_deployment(
                name=deployment_name,
                namespace=self.namespace
            )

            ready_replicas = deployment.status.ready_replicas or 0
            desired_replicas = deployment.spec.replicas or 0

            # Get pods
            pods = self.core_v1.list_namespaced_pod(
                namespace=self.namespace,
                label_selector=f"app={deployment_name}"
            )

            pod_status = []
            for pod in pods.items:
                pod_status.append({
                    "name": pod.metadata.name,
                    "phase": pod.status.phase,
                    "ready": all(c.ready for c in (pod.status.container_statuses or [])),
                    "restarts": sum(c.restart_count for c in (pod.status.container_statuses or []))
                })

            return {
                "deployment_name": deployment_name,
                "status": "running" if ready_replicas > 0 else "pending",
                "ready_replicas": ready_replicas,
                "desired_replicas": desired_replicas,
                "pods": pod_status
            }
        except ApiException as e:
            if e.status == 404:
                return {
                    "deployment_name": deployment_name,
                    "status": "not_found"
                }
            raise

    def _create_function_configmap(self, name: str, code: str):
        """Store function code in ConfigMap"""
        configmap = client.V1ConfigMap(
            metadata=client.V1ObjectMeta(name=name),
            data={"function.py": code}
        )

        try:
            self.core_v1.create_namespaced_config_map(
                namespace=self.namespace,
                body=configmap
            )
            logger.info(f"Created configmap {name}")
        except ApiException as e:
            if e.status == 409:  # Already exists
                self.core_v1.patch_namespaced_config_map(
                    name=name,
                    namespace=self.namespace,
                    body=configmap
                )
                logger.info(f"Updated configmap {name}")
            else:
                raise

    def _create_deployment(self, name: str, function_id: str, image: str,
                          memory_mb: int, cpu_millicores: int, replicas: int,
                          dependencies: List = None):
        """Create Kubernetes Deployment for function"""

        dependencies = dependencies or []

        # Container spec
        container = client.V1Container(
            name="function",
            image=image,
            image_pull_policy="IfNotPresent",  # Use local images
            ports=[client.V1ContainerPort(container_port=8080)],
            resources=client.V1ResourceRequirements(
                requests={
                    "memory": f"{memory_mb}Mi",
                    "cpu": f"{cpu_millicores}m",
                    "ephemeral-storage": "1Gi"  # Disk space for logs + /tmp
                },
                limits={
                    "memory": f"{int(memory_mb * 1.5)}Mi",  # 1.5x for burst capacity
                    "cpu": f"{int(cpu_millicores * 1.5)}m",   # 1.5x for burst capacity
                    "ephemeral-storage": "2Gi"  # Max 2GB disk usage
                }
            ),
            env=[
                client.V1EnvVar(name="FUNCTION_ID", value=function_id)
            ],
            volume_mounts=[
                client.V1VolumeMount(
                    name="function-code",
                    mount_path="/app/function.py",
                    sub_path="function.py"
                )
            ],
            liveness_probe=client.V1Probe(
                http_get=client.V1HTTPGetAction(
                    path="/health",
                    port=8080
                ),
                initial_delay_seconds=10,
                period_seconds=30,  # Reduced from 10s to ease CPU load
                timeout_seconds=5,
                failure_threshold=3
            ),
            readiness_probe=client.V1Probe(
                http_get=client.V1HTTPGetAction(
                    path="/health",
                    port=8080
                ),
                initial_delay_seconds=5,
                period_seconds=15,  # Reduced from 5s to ease CPU load
                timeout_seconds=3,
                failure_threshold=2
            ),
            security_context=client.V1SecurityContext(
                run_as_non_root=True,
                run_as_user=1000,  # Non-root user
                run_as_group=1000,
                allow_privilege_escalation=False,
                read_only_root_filesystem=False,  # Need writable /tmp
                capabilities=client.V1Capabilities(
                    drop=["ALL"],  # Drop all capabilities
                    add=["NET_BIND_SERVICE"]  # Only allow binding to privileged ports if needed
                )
            )
        )

        # Init container for installing dependencies (if any)
        init_containers = []
        volumes = [
            client.V1Volume(
                name="function-code",
                config_map=client.V1ConfigMapVolumeSource(
                    name=name
                )
            )
        ]

        if dependencies:
            # Add shared volume for installed packages (size-limited)
            volumes.append(
                client.V1Volume(
                    name="pip-packages",
                    empty_dir=client.V1EmptyDirVolumeSource(
                        size_limit="1Gi"  # Max 1GB for dependencies
                    )
                )
            )

            # Determine package manager and install path based on runtime
            runtime_lower = image.split(':')[0].replace('fnbox-', '')

            if 'python' in runtime_lower:
                # Install packages to a shared volume that Python will search
                # Use PYTHONPATH to add custom package directory
                pkg_manager = 'pip'
                install_cmd = ['sh', '-c', f'pip install --target /packages {" ".join(dependencies)}']
                package_path = '/packages'

                # Add PYTHONPATH env var to main container
                container.env.append(
                    client.V1EnvVar(name="PYTHONPATH", value="/packages:$PYTHONPATH")
                )

            elif 'nodejs' in runtime_lower:
                pkg_manager = 'npm'
                # Install to /packages and set NODE_PATH
                install_cmd = ['sh', '-c', f'cd /packages && npm install {" ".join(dependencies)}']
                package_path = '/packages'

                container.env.append(
                    client.V1EnvVar(name="NODE_PATH", value="/packages/node_modules")
                )

            elif 'ruby' in runtime_lower:
                pkg_manager = 'gem'
                # Ruby gems need to be installed one by one when versions are specified
                # Dependencies format: "package -v version" or just "package"
                gem_commands = []
                for dep in dependencies:
                    gem_commands.append(f'gem install --install-dir /packages {dep}')
                install_cmd = ['sh', '-c', ' && '.join(gem_commands)]
                package_path = '/packages'

                container.env.append(
                    client.V1EnvVar(name="GEM_PATH", value="/packages:$GEM_PATH")
                )

            elif 'java' in runtime_lower:
                pkg_manager = 'mvn'
                # Java uses Maven for dependency management
                # Dependencies format: "groupId:artifactId:version"
                install_cmd = ['sh', '-c', f'mvn dependency:copy-dependencies -DoutputDirectory=/packages {" ".join([f"-Dartifact={dep}" for dep in dependencies])}']
                package_path = '/packages'

                container.env.append(
                    client.V1EnvVar(name="CLASSPATH", value="/packages/*:$CLASSPATH")
                )

            elif 'dotnet' in runtime_lower:
                pkg_manager = 'dotnet'
                # .NET uses NuGet for package management
                # Dependencies format: "PackageName" or "PackageName -v version"
                dotnet_commands = []
                for dep in dependencies:
                    dotnet_commands.append(f'dotnet add package {dep}')
                install_cmd = ['sh', '-c', f'cd /packages && dotnet new classlib -o temp && cd temp && {" && ".join(dotnet_commands)}']
                package_path = '/packages'

            elif 'bash' in runtime_lower:
                # Bash doesn't have a traditional package manager for libraries
                # Skip dependency installation
                pkg_manager = None
                install_cmd = None
                package_path = None

            elif 'go' in runtime_lower:
                pkg_manager = 'go'
                # Go uses go get for dependencies
                # Dependencies format: "github.com/user/package@version"
                install_cmd = ['sh', '-c', f'export GOMODCACHE=/packages/pkg/mod && mkdir -p /packages/pkg/mod && cd /packages && go mod init function && go get {" ".join(dependencies)} && go mod download']
                package_path = '/packages'

                # Set Go environment variables for compilation
                container.env.extend([
                    client.V1EnvVar(name="GOPATH", value="/packages"),
                    client.V1EnvVar(name="GOMODCACHE", value="/packages/pkg/mod"),
                    client.V1EnvVar(name="GOCACHE", value="/tmp/go-build")
                ])

            elif 'rust' in runtime_lower:
                pkg_manager = 'cargo'
                # Rust uses Cargo for dependency management
                # Dependencies format: "package = \"version\""
                install_cmd = ['sh', '-c', f'cd /packages && cargo init --lib && {" && ".join([f"cargo add {dep}" for dep in dependencies])}']
                package_path = '/packages'

            else:
                # For other runtimes, skip dependency installation
                pkg_manager = None
                install_cmd = None
                package_path = None

            if pkg_manager and install_cmd:
                init_containers.append(
                    client.V1Container(
                        name="install-dependencies",
                        image=image,
                        command=install_cmd,
                        volume_mounts=[
                            client.V1VolumeMount(
                                name="pip-packages",
                                mount_path="/packages"
                            )
                        ],
                        resources=client.V1ResourceRequirements(
                            requests={
                                "memory": "256Mi",
                                "cpu": "200m"
                            },
                            limits={
                                "memory": "512Mi",
                                "cpu": "500m"
                            }
                        ),
                        security_context=client.V1SecurityContext(
                            run_as_non_root=True,
                            run_as_user=1000,  # Non-root user
                            run_as_group=1000,
                            allow_privilege_escalation=False,
                            read_only_root_filesystem=False,  # Need writable /packages
                            capabilities=client.V1Capabilities(
                                drop=["ALL"]  # Drop all capabilities
                            )
                        )
                    )
                )

                # Add package volume mount to main container
                if package_path:
                    container.volume_mounts.append(
                        client.V1VolumeMount(
                            name="pip-packages",
                            mount_path=package_path
                        )
                    )

        # Pod template
        template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(
                labels={"app": name, "function-id": function_id, "component": "function"}
            ),
            spec=client.V1PodSpec(
                init_containers=init_containers if init_containers else None,
                containers=[container],
                volumes=volumes,
                restart_policy="Always",
                priority_class_name="fnbox-function-priority",  # Use lower priority
                security_context=client.V1PodSecurityContext(
                    run_as_non_root=True,
                    run_as_user=1000,
                    run_as_group=1000,
                    fs_group=1000,
                    seccomp_profile=client.V1SeccompProfile(
                        type="RuntimeDefault"  # Use default seccomp profile
                    )
                ),
                # Prevent fork bombs - limit processes per pod
                # Note: This requires PID limits to be enabled in kubelet
                termination_grace_period_seconds=30  # Max 30s to gracefully terminate
                # Note: activeDeadlineSeconds is not supported in Deployments, only bare Pods/Jobs
            )
        )

        # Deployment spec
        spec = client.V1DeploymentSpec(
            replicas=replicas,
            selector=client.V1LabelSelector(
                match_labels={"app": name}
            ),
            template=template
        )

        deployment = client.V1Deployment(
            api_version="apps/v1",
            kind="Deployment",
            metadata=client.V1ObjectMeta(
                name=name,
                labels={"function-id": function_id}
            ),
            spec=spec
        )

        return self.apps_v1.create_namespaced_deployment(
            namespace=self.namespace,
            body=deployment
        )

    def _create_service(self, name: str, deployment_name: str):
        """Create Kubernetes Service for load balancing"""

        service = client.V1Service(
            api_version="v1",
            kind="Service",
            metadata=client.V1ObjectMeta(name=name),
            spec=client.V1ServiceSpec(
                selector={"app": deployment_name},
                ports=[
                    client.V1ServicePort(
                        protocol="TCP",
                        port=8080,
                        target_port=8080
                    )
                ],
                type="ClusterIP"
            )
        )

        return self.core_v1.create_namespaced_service(
            namespace=self.namespace,
            body=service
        )

    def _create_hpa(self, deployment_name: str):
        """
        Create Horizontal Pod Autoscaler for the function deployment.

        Configures automatic scaling based on CPU and memory usage:
        - Min replicas: 1 (no cold starts)
        - Max replicas: 5 (conservative limit to protect cluster)
        - Target CPU: 70%
        - Target memory: 80%
        """
        hpa = client.V2HorizontalPodAutoscaler(
            api_version="autoscaling/v2",
            kind="HorizontalPodAutoscaler",
            metadata=client.V1ObjectMeta(
                name=f"{deployment_name}-hpa"
            ),
            spec=client.V2HorizontalPodAutoscalerSpec(
                scale_target_ref=client.V2CrossVersionObjectReference(
                    api_version="apps/v1",
                    kind="Deployment",
                    name=deployment_name
                ),
                min_replicas=1,
                max_replicas=5,  # Conservative limit to protect cluster resources
                metrics=[
                    # CPU-based scaling
                    client.V2MetricSpec(
                        type="Resource",
                        resource=client.V2ResourceMetricSource(
                            name="cpu",
                            target=client.V2MetricTarget(
                                type="Utilization",
                                average_utilization=70
                            )
                        )
                    ),
                    # Memory-based scaling
                    client.V2MetricSpec(
                        type="Resource",
                        resource=client.V2ResourceMetricSource(
                            name="memory",
                            target=client.V2MetricTarget(
                                type="Utilization",
                                average_utilization=80
                            )
                        )
                    )
                ],
                behavior=client.V2HorizontalPodAutoscalerBehavior(
                    scale_up=client.V2HPAScalingRules(
                        stabilization_window_seconds=0,  # Scale up immediately
                        policies=[
                            client.V2HPAScalingPolicy(
                                type="Percent",
                                value=100,  # Double pods at once if needed
                                period_seconds=15
                            )
                        ]
                    ),
                    scale_down=client.V2HPAScalingRules(
                        stabilization_window_seconds=300,  # Wait 5 min before scaling down
                        policies=[
                            client.V2HPAScalingPolicy(
                                type="Pods",
                                value=1,  # Remove one pod at a time
                                period_seconds=60
                            )
                        ]
                    )
                )
            )
        )

        try:
            self.autoscaling_v2.create_namespaced_horizontal_pod_autoscaler(
                namespace=self.namespace,
                body=hpa
            )
            logger.info(f"Created HPA for {deployment_name} (min:1, max:5, CPU:70%, memory:80%)")
        except ApiException as e:
            if e.status == 409:  # Already exists
                logger.info(f"HPA for {deployment_name} already exists")
            else:
                logger.warning(f"Failed to create HPA: {e}")
                # Don't fail deployment if HPA creation fails

    def _wait_for_deployment(self, name: str, timeout: int = 60) -> bool:
        """Wait for deployment to be ready"""
        start = time.time()

        while time.time() - start < timeout:
            try:
                deployment = self.apps_v1.read_namespaced_deployment(
                    name=name,
                    namespace=self.namespace
                )

                if (deployment.status.ready_replicas and
                    deployment.status.ready_replicas > 0):
                    logger.info(f"Deployment {name} is ready")
                    return True

                time.sleep(2)
            except ApiException as e:
                logger.warning(f"Error checking deployment status: {e}")
                time.sleep(2)

        logger.error(f"Deployment {name} not ready after {timeout}s")
        return False

    def list_functions(self) -> List[Dict]:
        """List all function deployments"""
        try:
            deployments = self.apps_v1.list_namespaced_deployment(
                namespace=self.namespace
            )

            results = []
            for deployment in deployments.items:
                function_id = deployment.metadata.labels.get("function-id", "unknown")
                results.append({
                    "function_id": function_id,
                    "deployment_name": deployment.metadata.name,
                    "replicas": deployment.spec.replicas,
                    "ready_replicas": deployment.status.ready_replicas or 0,
                    "created_at": deployment.metadata.creation_timestamp
                })

            return results
        except ApiException as e:
            logger.error(f"Failed to list deployments: {e}")
            return []

    def scale_function(self, deployment_name: str, replicas: int):
        """Scale function deployment"""
        try:
            # Get current deployment
            deployment = self.apps_v1.read_namespaced_deployment(
                name=deployment_name,
                namespace=self.namespace
            )

            # Update replicas
            deployment.spec.replicas = replicas

            self.apps_v1.patch_namespaced_deployment(
                name=deployment_name,
                namespace=self.namespace,
                body=deployment
            )

            logger.info(f"Scaled deployment {deployment_name} to {replicas} replicas")
        except ApiException as e:
            logger.error(f"Failed to scale deployment: {e}")
            raise
