#!/bin/bash

new_compilation_dir=`pwd`
old_compilation_dir=${HOME}"/.swan-cli/vendor/program-compiler/current"
echo ""
echo "\033[31m【新版编译路径为】\033[0m：${new_compilation_dir}\n"
echo "\033[34m【当前current目录软链接指向】\033[0m：`readlink -n ${old_compilation_dir}`"
echo "\n删除current软链接, 请确认!!\n"
# 删除已有软链接
rm -ir ${old_compilation_dir}
# 建立软链接到新版本编译
ln -s ${new_compilation_dir} ${old_compilation_dir}
echo "\033[31m【更新后current目录软链接指向】\033[0m：`readlink -n ${old_compilation_dir}`\n"
