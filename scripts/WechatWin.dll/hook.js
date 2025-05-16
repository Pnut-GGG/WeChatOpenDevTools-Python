// 设置自动恢复时间（毫秒）
var AUTO_RESTORE_DELAY = 15000;

// 保存原始内存和函数
var originalData = {};

function readStdString(s) {
    var flag = s.add(23).readU8()
    if (flag == 0x80) {
        // 从堆中读取
        var size = s.add(8).readUInt()
        return s.readPointer().readUtf8String(size)
    } else {
        // 从栈中读取
        return s.readUtf8String(flag)
    }
}
function writeStdString(s, content) {
    var flag = s.add(23).readU8()
    if (flag == 0x80) {
        // 从堆中写入
        var orisize = s.add(8).readUInt()
        if (content.length > orisize) {
            throw "must below orisize!"
        }
        s.readPointer().writeUtf8String(content)
        s.add(8).writeUInt(content.length)
    } else {
        // 从栈中写入
        if (content.length > 22) {
            throw "max 23 for stack str"
        }
        s.writeUtf8String(content)
        s.add(23).writeU8(content.length)
    }
}

// 创建一个函数，用于拦截CreateProcessW函数
var cpsPtr = Module.findExportByName("kernel32.dll", "CreateProcessW");
var cps = new NativeFunction(cpsPtr,'bool', ['pointer', 'pointer', 'pointer', 'pointer', 'bool', 'uint32', 'pointer', 'pointer', 'pointer', 'pointer']);

// 保存原始函数
originalData.createProcessW = {
    ptr: cpsPtr,
    replaced: false
};

// 拦截CreateProcessW函数，在函数调用前和调用后分别执行onEnter和onLeave函数
Interceptor.attach(cpsPtr, {
    onEnter: function (args) {
        // 获取CreateProcessW函数的参数
        this.pi = args[9];
        this.exepath = args[0];
        this.cmdline = args[1];
        let cmdlineStr = this.cmdline.readUtf16String();
        
        // 保存原始命令行
        this.originalCmdline = cmdlineStr;
        
        // 替换参数中的--log-level=2为--log-level=0 --xweb-enable-inspect=1
        let modifiedCmdline = cmdlineStr.replaceAll("--log-level=2", "--log-level=0 --xweb-enable-inspect=1");
        
        if (cmdlineStr !== modifiedCmdline) {
            this.cmdline.writeUtf16String(modifiedCmdline);
            send("[+] 已修改命令行参数，启用调试功能");
            originalData.createProcessW.replaced = true;
        }
    },
    onLeave: function (retval) {
        send("[+] 命令行参数：" + this.cmdline.readUtf16String());
        send("[+] 将在 " + (AUTO_RESTORE_DELAY / 1000) + " 秒后自动恢复原始状态");
    }
});

// 设置定时器，在指定时间后恢复原始状态
setTimeout(function() {
    restoreAll();
}, AUTO_RESTORE_DELAY);

function restoreAll() {
    send("[+] 开始恢复原始状态...");
    
    // 这里我们不需要真正恢复CreateProcessW函数，因为它只在创建进程时被调用一次
    // 但我们可以记录恢复操作
    if (originalData.createProcessW.replaced) {
        send("[+] CreateProcessW函数参数已被修改，但进程已创建，无需恢复");
    }
    
    send("[+] 恢复完成");
}
