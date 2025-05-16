# commons.py
from utils.colors import Color
from utils.wechatutils import WechatUtils
import frida
import sys
import time
import platform
import argparse

class Commons:
    def __init__(self):
        self.wechatutils_instance = WechatUtils()
        self.device = frida.get_local_device()
        self.process = self.device.enumerate_processes()
        self.version_list = []
        self.configs_path = ""
        self.active_sessions = []
        self.restore_timeout = 60  # 默认60秒后恢复原始内存

    def onMessage(self, message, data):
        if message['type'] == 'send':
            print(Color.GREEN + message['payload'], Color.END)
        elif message['type'] == 'error':
            print(Color.RED + message['stack'], Color.END)

    def inject_wechatEx(self, pid, code):
        try:
            session = frida.attach(pid)
            script = session.create_script(code)
            script.on("message", self.onMessage)
            script.load()
            
            # 设置恢复超时时间（毫秒）
            if hasattr(self, 'restore_timeout') and self.restore_timeout > 0:
                try:
                    script.exports.set_restore_timeout(self.restore_timeout * 1000)
                    print(Color.GREEN + f"[+] 已设置 {self.restore_timeout} 秒后自动恢复内存" + Color.END)
                except Exception as e:
                    print(Color.RED + f"[-] 设置恢复超时时间失败: {e}" + Color.END)
            
            print(Color.GREEN + f"[+] 成功注入微信PID: {pid}", Color.END)
            return session, script
        except Exception as e:
            print(Color.RED + f"[-] 注入微信失败PID {pid}: {e}", Color.END)
            return None, None

    def inject_wechatDLL(self, path, code):
        pid = self.device.spawn(path)
        session = frida.attach(pid)
        script = session.create_script(code)
        script.on("message", self.onMessage)
        script.load()
        self.device.resume(pid)
        time.sleep(10)
        session.detach()

    def set_restore_timeout(self, seconds):
        """设置恢复原始内存的超时时间（秒）"""
        self.restore_timeout = seconds
        print(Color.GREEN + f"[+] 设置恢复超时时间为 {seconds} 秒" + Color.END)

    def load_wechatEx_configs(self):
        path = self.wechatutils_instance.get_configs_path()
        if get_cpu_architecture() == "MacOS x64":
            wechat_instances = self.wechatutils_instance.get_wechat_pids_and_versions_mac()
        else:
            wechat_instances = self.wechatutils_instance.get_wechat_pids_and_versions()

        if wechat_instances:
            for pid, version in wechat_instances:
                try:
                    wechatEx_hookcode = open(path + "../scripts/hook.js", "r", encoding="utf-8").read()
                    wechatEx_addresses = open(path + f"../configs/address_{version}_x64.json").read()
                    wechatEx_hookcode = "var address=" + wechatEx_addresses + wechatEx_hookcode
                    session, script = self.inject_wechatEx(pid, wechatEx_hookcode)
                    if session:
                        self.active_sessions.append((session, script))
                    print(Color.GREEN +f"[+] 成功注入{version}小程序版本，PID: {pid}", Color.END)
                except Exception as e:
                    print(Color.RED + f"[-] 注入{version}小程序版本失败！{e}", Color.END)
        else:
            self.wechatutils_instance.print_process_not_found_message()

        # 管理会话
        while self.active_sessions:
            self.manage_sessions()
            time.sleep(5)  # 每5秒检查一次

    def load_wechatEXE_configs(self):
        wechat_instances = self.wechatutils_instance.get_wechat_pids_and_versions()
        if wechat_instances:
            print(Color.RED + f"[-] 请退出所有微信实例后再执行该命令 " + Color.END)
            return 0
        
        wechatEXEpath = self.wechatutils_instance.find_installation_path("微信")
        path = self.wechatutils_instance.get_configs_path()
        wechatEXE_hookcode = open(path + "..\\scripts\\WechatWin.dll\\hook.js", "r", encoding="utf-8").read()
        self.inject_wechatDLL(wechatEXEpath, wechatEXE_hookcode)

    def load_wechatEXE_and_wechatEx(self):
        wechat_instances = self.wechatutils_instance.get_wechat_pids_and_versions()
        if wechat_instances:
            print(Color.RED + f"[-] 请关闭所有微信实例后再执行该命令 " + Color.END)
            return 0
        self.load_wechatEXE_configs()
        self.load_wechatEx_configs()

    def manage_sessions(self):
        for session_tuple in self.active_sessions[:]:  # 使用切片创建副本以便在迭代时修改
            session, script = session_tuple
            if session.is_detached:
                print(f"Session {session} detached, removing from active sessions.")
                self.active_sessions.remove(session_tuple)

def get_cpu_architecture():
    try:
        cpu_arch = platform.platform().lower()
        if "64bit" in cpu_arch and "macos" in cpu_arch:
            return "MacOS x64"
        return "Windows"  # 默认返回Windows
    except Exception as e:
        print(Color.RED, f"[-] Error detecting CPU architecture: {e} ", Color.END)
        return "Windows"

# 主函数示例
if __name__ == "__main__":
    commons = Commons()
    commons.load_wechatEx_configs()
