#!/usr/bin/env python3
"""
VelocityBrain Core API Startup Test

Simple test to verify the core API can start successfully.
"""

import os
import sys

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

def test_imports():
    """Test that all modules can be imported."""
    print("🔍 Testing imports...")
    
    try:
        from core.config import settings
        print("  ✓ Core config imported")
    except Exception as e:
        print(f"  ❌ Core config failed: {e}")
        return False
    
    try:
        from core.logging_config import get_logger
        print("  ✓ Logging config imported")
    except Exception as e:
        print(f"  ❌ Logging config failed: {e}")
        return False
    
    try:
        from core_api.auth import create_auth_router
        print("  ✓ Auth module imported")
    except Exception as e:
        print(f"  ❌ Auth module failed: {e}")
        return False
    
    try:
        from core_api.brain import create_brain_router
        print("  ✓ Brain module imported")
    except Exception as e:
        print(f"  ❌ Brain module failed: {e}")
        return False
    
    try:
        from core_api.skills import create_skills_router
        print("  ✓ Skills module imported")
    except Exception as e:
        print(f"  ❌ Skills module failed: {e}")
        return False
    
    try:
        from core_api.monitoring import create_monitoring_router
        print("  ✓ Monitoring module imported")
    except Exception as e:
        print(f"  ❌ Monitoring module failed: {e}")
        return False
    
    return True


def test_config():
    """Test configuration loading."""
    print("\n⚙️  Testing configuration...")
    
    try:
        from core.config import settings
        
        print(f"  ✓ App name: {settings.app_name}")
        print(f"  ✓ Environment: {settings.env}")
        print(f"  ✓ Database URL configured: {'postgresql://' in settings.database_url}")
        print(f"  ✓ Secret key set: {bool(settings.secret_key)}")
        
        return True
    except Exception as e:
        print(f"  ❌ Configuration failed: {e}")
        return False


def test_fastapi_app():
    """Test FastAPI application creation."""
    print("\n🚀 Testing FastAPI application...")
    
    try:
        from core_api.main import app
        
        print(f"  ✓ FastAPI app created: {app.title}")
        print(f"  ✓ Version: {app.version}")
        print(f"  ✓ Routes configured: {len(app.routes)}")
        
        return True
    except Exception as e:
        print(f"  ❌ FastAPI app failed: {e}")
        return False


def test_identity_spec():
    """Test identity specification loading."""
    print("\n📄 Testing identity specification...")
    
    try:
        identity_path = os.path.join(os.path.dirname(__file__), 'identity.spec.json')
        
        if os.path.exists(identity_path):
            import json
            with open(identity_path, 'r') as f:
                identity = json.load(f)
            
            print(f"  ✓ Identity spec loaded: {identity['identity']['name']}")
            print(f"  ✓ Version: {identity['identity']['version']}")
            print(f"  ✓ Policy configured: {bool(identity.get('policy'))}")
            
            return True
        else:
            print(f"  ❌ Identity spec not found: {identity_path}")
            return False
            
    except Exception as e:
        print(f"  ❌ Identity spec failed: {e}")
        return False


def main():
    """Run all startup tests."""
    print("  VelocityBrain Core API Startup Test")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_config,
        test_fastapi_app,
        test_identity_spec
    ]
    
    results = []
    for test in tests:
        results.append(test())
    
    print("\n📊 Test Results:")
    passed = sum(results)
    total = len(results)
    
    print(f"  Passed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 All tests passed! Core API is ready to start.")
        print("\n🚀 To start the server:")
        print("  uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        print("\n📖 API Documentation:")
        print("  http://localhost:8000/docs")
    else:
        print(f"\n❌ {total - passed} tests failed. Please fix issues before starting.")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
