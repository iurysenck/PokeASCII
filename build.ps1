$ErrorActionPreference = "Stop"

$vcvars = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$cmake  = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
$ctest  = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\ctest.exe"
$ninja  = "C:\Users\iury\AppData\Local\Programs\Python\Python313\Scripts\ninja.exe"

cmd /c "`"$vcvars`" && `"$cmake`" -B build -G Ninja -DCMAKE_MAKE_PROGRAM=`"$ninja`" -DCMAKE_BUILD_TYPE=Release && `"$cmake`" --build build && `"$ctest`" --test-dir build --output-on-failure"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
