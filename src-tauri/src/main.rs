// 防止 Windows 释放构建时出现控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mmy_3d_model_viewer_lib::run()
}
