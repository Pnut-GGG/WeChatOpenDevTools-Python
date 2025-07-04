;
//获取WeChatAppEx.exe的基址
var module = Process.findModuleByName("WeChatAppEx.exe") || Process.findModuleByName('WeChatAppEx Framework')
var base = module.base;
// console.log("模块名称:",module.name);
// console.log("模块地址:",module.base);
// console.log("大小:",module.size);

// 保存原始内存内容的对象
var originalMemory = {};
// 设置自动恢复时间（毫秒）
var AUTO_RESTORE_DELAY = 15000;

Object.keys(address).forEach(key => {
    key != "Version" ? address[key] = base.add(address[key]) : false
});

send("[+] WeChatAppEx 注入成功!");
send("[+] 当前小程序版本: " + address.Version);
send("[+] 等待小程序加载...");
send("[+] 注意: 将在 " + (AUTO_RESTORE_DELAY / 1000) + " 秒后自动恢复内存!");

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
function sendMessage(msg) {
    msg === null || undefined ? send(msg) : send("[+] 已还原完整F12")
    // send("[+] 已还原完整F12")
}

// 保存内存区域内容
function backupMemory(address, size, key) {
    try {
        originalMemory[key] = new Uint8Array(address.readByteArray(size));
        send("[+] 已备份内存区域: " + key);
    } catch (e) {
        send("[-] 备份内存失败: " + e.message);
    }
}

// 恢复内存区域内容
function restoreMemory(address, key) {
    try {
        if (originalMemory[key]) {
            Memory.protect(address, originalMemory[key].length, 'rw-');
            address.writeByteArray(originalMemory[key]);
            send("[+] 已恢复内存区域: " + key);
            return true;
        }
    } catch (e) {
        send("[-] 恢复内存失败: " + e.message);
    }
    return false;
}

// 恢复所有修改的内存
function restoreAllMemory() {
    send("[+] 开始恢复所有修改的内存...");
    var restored = 0;
    
    for (var key in originalMemory) {
        if (key.startsWith("MenuItemDevTools")) {
            var addr = address.MenuItemDevToolsString;
            if (key.includes("PtrData")) {
                var menuItemDevToolsStringCr = new Uint8Array(address.MenuItemDevToolsString.readByteArray(7));
                var intptr_ = (menuItemDevToolsStringCr[3] & 0xFF) | ((menuItemDevToolsStringCr[4] & 0xFF) << 8) | ((menuItemDevToolsStringCr[5] & 0xFF) << 16) | ((menuItemDevToolsStringCr[6] & 0xFF) << 24);
                addr = address.MenuItemDevToolsString.add(intptr_ + 7);
            }
            if (restoreMemory(addr, key)) {
                restored++;
            }
        }
    }
    
    send("[+] 内存恢复完成，共恢复 " + restored + " 个区域");
}

function replaceParams() {
    Interceptor.attach(address.LaunchAppletBegin, {
        onEnter(args) {
            send("[+] HOOK到小程序加载! " + readStdString(args[1]))
            for (var i = 0; i < 0x1000; i += 8) {
                try {
                    var s = readStdString(args[2].add(i))
                    var s1 = s.replaceAll('"enable_vconsole":false', '"enable_vconsole": true')
                    // .replaceAll("md5", "md6")
                    // .replaceAll('"frameset":false', '"frameset": true')
                    //"frameset":false
                    if (s !== s1) {
                        // 备份原始数据
                        var backupKey = "LaunchAppletParams_" + i;
                        if (!originalMemory[backupKey]) {
                            originalMemory[backupKey] = s;
                        }
                        writeStdString(args[2].add(i), s1)
                    }
                } catch (a) {
                }
            }
        }
    })
}

// 过新版8555检测
if (address.MenuItemDevToolsString) {
    // 备份原始数据
    backupMemory(address.MenuItemDevToolsString, 7, "MenuItemDevTools");
    
    var menuItemDevToolsStringCr = new Uint8Array(address.MenuItemDevToolsString.readByteArray(7));
    var intptr_ = (menuItemDevToolsStringCr[3] & 0xFF) | ((menuItemDevToolsStringCr[4] & 0xFF) << 8) | ((menuItemDevToolsStringCr[5] & 0xFF) << 16) | ((menuItemDevToolsStringCr[6] & 0xFF) << 24);
    var menuItemDevToolsStringPtrData = address.MenuItemDevToolsString.add(intptr_ + 7);
    
    // 备份指针数据
    backupMemory(menuItemDevToolsStringPtrData, 8, "MenuItemDevToolsPtrData");
    
    Memory.protect(menuItemDevToolsStringPtrData, 8, 'rw-')
    menuItemDevToolsStringPtrData.writeUtf8String("DevTools");
    replaceParams()
    setupInterceptor()
}

// 设置定时器，在指定时间后恢复内存
setTimeout(function() {
    restoreAllMemory();
    send("[+] 自动恢复内存完成，已恢复到原始状态");
}, AUTO_RESTORE_DELAY);

function setupInterceptor() {
    /**
     * 
     */
    switch (address.Version) {
        case 8555:
            Interceptor.attach(address.WechatAppHtml, {
                onEnter(args) {
                    // 备份原始寄存器值
                    this.originalRdx = this.context.rdx;
                    // 修改寄存器
                    this.context.rdx = address.WechatWebHtml;
                    sendMessage()
                }
            });
            break;

        case 9105:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    // 备份原始寄存器值
                    this.originalR8 = this.context.r8;
                    // 修改寄存器
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;

        case 9079:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;

        case 9115:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;

        case 9129:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;
        case 11159:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;          

        case 13080811:
            Interceptor.attach(address.WechatAppHtml, {
                onEnter(args) {
                    this.originalRsi = this.context.rsi;
                    this.context.rsi = address.WechatWebHtml
                    sendMessage()
                }
            })
            break;
            
        case 13080812:
            Interceptor.attach(address.WechatAppHtml, {
                onEnter(args) {
                    this.originalRsi = this.context.rsi;
                    this.context.rsi = address.WechatWebHtml
                    sendMessage()
                }
            })
            break;
            
        case 9193:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;
        case 11205:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;
        case 11275:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;
        case 11253:
            Interceptor.attach(address.SwitchVersion, {
                onEnter(args) {
                    this.originalR8 = this.context.r8;
                    this.context.r8 = this.context.rax
                    sendMessage()
                }
            })
            break;
        default:
            console.log(address.Version);
            Interceptor.attach(address.WechatAppHtml, {
                onEnter(args) {
                    this.originalRdx = this.context.rdx;
                    this.context.rdx = address.WechatWebHtml;
                    sendMessage()
                }
            });
            break;
    }
}
