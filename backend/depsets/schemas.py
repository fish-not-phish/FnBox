from ninja import Schema
from typing import List, Optional
from datetime import datetime


class DepsetPackageOut(Schema):
    """Schema for depset package output"""
    id: int
    package_name: str
    version_spec: str
    order: int
    notes: str


class DepsetPackageIn(Schema):
    """Schema for creating/updating depset package"""
    package_name: str
    version_spec: str = ""
    order: int = 0
    notes: str = ""


class DepsetOut(Schema):
    """Schema for depset output"""
    id: int
    name: str
    slug: str
    description: str
    runtime_type: str
    runtime_version: str
    python_version: str  # Deprecated but kept for backward compatibility
    is_public: bool
    team_id: int
    team_name: str
    package_count: int
    created_at: datetime
    updated_at: datetime
    created_by_username: Optional[str] = None


class DepsetDetailOut(DepsetOut):
    """Extended depset schema with package list"""
    packages: List[DepsetPackageOut]
    requirements_txt: str


class DepsetListOut(Schema):
    """Schema for list of depsets (minimal info)"""
    id: int
    name: str
    slug: str
    description: str
    runtime_type: str
    runtime_version: str
    python_version: str  # Deprecated but kept for backward compatibility
    is_public: bool
    package_count: int
    created_at: datetime


class DepsetCreateIn(Schema):
    """Schema for creating a new depset"""
    name: str
    slug: Optional[str] = None
    description: str = ""
    runtime_type: str = "python"
    runtime_version: str = "3.11"
    python_version: Optional[str] = None  # Deprecated, use runtime_version
    is_public: bool = False
    packages: List[DepsetPackageIn] = []


class DepsetUpdateIn(Schema):
    """Schema for updating depset details"""
    name: Optional[str] = None
    description: Optional[str] = None
    runtime_type: Optional[str] = None
    runtime_version: Optional[str] = None
    python_version: Optional[str] = None  # Deprecated, use runtime_version
    is_public: Optional[bool] = None
    packages: Optional[List[DepsetPackageIn]] = None
