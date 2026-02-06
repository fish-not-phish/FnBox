# .NET runtime (supports 8.0, 9.0, 10.0)
ARG DOTNET_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION}

# Install common utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy agent source
COPY dotnet/agent.cs /app/agent.cs

# Create a minimal project file for compilation
RUN echo '<Project Sdk="Microsoft.NET.Sdk">' > /app/agent.csproj && \
    echo '  <PropertyGroup>' >> /app/agent.csproj && \
    echo '    <OutputType>Exe</OutputType>' >> /app/agent.csproj && \
    echo '    <TargetFramework>net8.0</TargetFramework>' >> /app/agent.csproj && \
    echo '    <LangVersion>latest</LangVersion>' >> /app/agent.csproj && \
    echo '    <Nullable>enable</Nullable>' >> /app/agent.csproj && \
    echo '  </PropertyGroup>' >> /app/agent.csproj && \
    echo '  <ItemGroup>' >> /app/agent.csproj && \
    echo '    <PackageReference Include="Microsoft.CodeAnalysis.CSharp" Version="4.8.0" />' >> /app/agent.csproj && \
    echo '    <PackageReference Include="System.Text.Json" Version="8.0.0" />' >> /app/agent.csproj && \
    echo '  </ItemGroup>' >> /app/agent.csproj && \
    echo '</Project>' >> /app/agent.csproj

# Install dependencies and build agent
RUN dotnet restore && \
    dotnet build -c Release -o /app/build

# Create non-root user
RUN useradd -u 1001 -m -s /bin/bash dotnetuser && \
    chown -R dotnetuser:dotnetuser /app

USER dotnetuser

# Expose agent port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run agent
CMD ["dotnet", "/app/build/agent.dll"]
