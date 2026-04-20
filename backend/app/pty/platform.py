import sys

IS_WINDOWS: bool = sys.platform == "win32"

if IS_WINDOWS:
    from winpty import PtyProcess as _NativePtyProcess  # type: ignore
else:
    from ptyprocess import PtyProcess as _NativePtyProcess  # type: ignore

__all__ = ["IS_WINDOWS", "_NativePtyProcess"]
