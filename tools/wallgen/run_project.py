#!/usr/bin/env python3
"""
Automated project runner that handles all 5 stages:
1. Initialization (setup virtual environment)
2. Installation (install dependencies)
3. Building (build the project if needed)
4. Testing (run tests)
5. Running (execute the main application)
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path
import shutil


def run_command(cmd, cwd=None, check=True, capture_output=False):
    """Run a command and return the result."""
    print(f"Running: {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            check=check,
            capture_output=capture_output,
            text=True,
            shell=False
        )
        if capture_output:
            return result.stdout, result.stderr
        return result
    except subprocess.CalledProcessError as e:
        print(f"Command failed with exit code {e.returncode}")
        if capture_output:
            print(f"stdout: {e.stdout}")
            print(f"stderr: {e.stderr}")
        raise
    except FileNotFoundError:
        print(f"Command not found: {cmd[0]}")
        raise


def stage1_initialization(project_root):
    """Stage 1: Initialize the project (create virtual environment)."""
    print("\n=== Stage 1: Initialization ===")
    venv_path = project_root / "venv"

    if venv_path.exists():
        print(f"Virtual environment already exists at {venv_path}")
    else:
        print(f"Creating virtual environment at {venv_path}")
        run_command([sys.executable, "-m", "venv", str(venv_path)])

    # Return the path to the virtual environment's Python interpreter
    if sys.platform == "win32":
        python_exe = venv_path / "Scripts" / "python.exe"
        pip_exe = venv_path / "Scripts" / "pip.exe"
    else:
        python_exe = venv_path / "bin" / "python"
        pip_exe = venv_path / "bin" / "pip"

    if not python_exe.exists():
        raise RuntimeError(f"Python executable not found in virtual environment at {python_exe}")

    return python_exe, pip_exe


def stage2_installation(pip_exe, project_root):
    """Stage 2: Install dependencies."""
    print("\n=== Stage 2: Installation ===")
    requirements_file = project_root / "requirements.txt"

    if requirements_file.exists():
        print(f"Installing dependencies from {requirements_file}")
        run_command([str(pip_exe), "install", "-r", str(requirements_file)])
    else:
        print("No requirements.txt found. Skipping installation.")


def stage3_building(python_exe, project_root):
    """Stage 3: Build the project."""
    print("\n=== Stage 3: Building ===")
    # Check for common build configuration files
    setup_py = project_root / "setup.py"
    pyproject_toml = project_root / "pyproject.toml"

    if setup_py.exists():
        print("Building with setup.py")
        run_command([str(python_exe), "setup.py", "sdist", "bdist_wheel"])
    elif pyproject_toml.exists():
        print("Building with pyproject.toml (using python -m build)")
        # Ensure build is installed
        run_command([str(pip_exe), "install", "build"])
        run_command([str(python_exe), "-m", "build"])
    else:
        print("No build configuration found (setup.py or pyproject.toml). Skipping build.")


def stage4_testing(python_exe, project_root):
    """Stage 4: Run tests."""
    print("\n=== Stage 4: Testing ===")
    # Check for test configuration or test files
    test_dir = project_root / "tests"
    pytest_ini = project_root / "pytest.ini"
    pyproject_toml = project_root / "pyproject.toml"

    # Determine if we should run tests
    should_run_tests = False
    if test_dir.exists() and any(test_dir.iterdir()):
        should_run_tests = True
    elif pytest_ini.exists():
        should_run_tests = True
    elif pyproject_toml.exists():
        # Check if pyproject.toml has pytest configuration
        try:
            content = pyproject_toml.read_text()
            if "[tool.pytest]" in content or "pytest" in content:
                should_run_tests = True
        except:
            pass

    if should_run_tests:
        print("Running tests with pytest")
        run_command([str(python_exe), "-m", "pytest"])
    else:
        print("No tests found. Skipping testing.")


def stage5_running(python_exe, project_root):
    """Stage 5: Run the main application."""
    print("\n=== Stage 5: Running ===")
    # Look for common entry points
    entry_points = [
        "main.py",
        "app.py",
        "run.py",
        "src/main.py",
        "src/app.py"
    ]

    main_file = None
    for entry in entry_points:
        candidate = project_root / entry
        if candidate.exists():
            main_file = candidate
            break

    if main_file is None:
        # Check for a package structure with __main__
        for item in project_root.iterdir():
            if item.is_dir() and not item.name.startswith(".") and item.name not in ["venv", "__pycache__", "build", "dist"]:
                init_file = item / "__main__.py"
                if init_file.exists():
                    main_file = init_file
                    break
                # Check for a module that can be run with -m
                if (item / "__init__.py").exists():
                    # Try to run as a module
                    print(f"No explicit main file found. Trying to run module {item.name} with -m")
                    run_command([str(python_exe), "-m", item.name])
                    return

    if main_file:
        print(f"Running main application: {main_file}")
        run_command([str(python_exe), str(main_file)])
    else:
        print("No main application found. Nothing to run.")


def main():
    parser = argparse.ArgumentParser(description="Run all 5 stages of a project")
    parser.add_argument(
        "--skip-init",
        action="store_true",
        help="Skip initialization stage (assumes venv exists)"
    )
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="Skip installation stage"
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip building stage"
    )
    parser.add_argument(
        "--skip-test",
        action="store_true",
        help="Skip testing stage"
    )
    parser.add_argument(
        "--skip-run",
        action="store_true",
        help="Skip running stage"
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Root directory of the project (default: current directory)"
    )

    args = parser.parse_args()

    project_root = args.project_root.resolve()
    print(f"Project root: {project_root}")

    try:
        # Stage 1: Initialization
        if not args.skip_init:
            python_exe, pip_exe = stage1_initialization(project_root)
        else:
            # Use existing venv or system Python
            venv_path = project_root / "venv"
            if sys.platform == "win32":
                python_exe = venv_path / "Scripts" / "python.exe"
                pip_exe = venv_path / "Scripts" / "pip.exe"
            else:
                python_exe = venv_path / "bin" / "python"
                pip_exe = venv_path / "bin" / "pip"

            if not python_exe.exists():
                print("Virtual environment not found. Falling back to system Python.")
                python_exe = sys.executable
                pip_exe = sys.executable  # pip might not be available, but we'll try

        # Stage 2: Installation
        if not args.skip_install:
            stage2_installation(pip_exe, project_root)

        # Stage 3: Building
        if not args.skip_build:
            stage3_building(python_exe, project_root)

        # Stage 4: Testing
        if not args.skip_test:
            stage4_testing(python_exe, project_root)

        # Stage 5: Running
        if not args.skip_run:
            stage5_running(python_exe, project_root)

        print("\n=== All stages completed successfully! ===")

    except Exception as e:
        print(f"\n=== Error occurred: {e} ===")
        sys.exit(1)


if __name__ == "__main__":
    main()