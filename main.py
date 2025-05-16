from argparse import RawTextHelpFormatter
from utils.commons import Commons
from utils.banner import generate_banner
from utils.colors import Color
import argparse



def print_colored_message(message, color):
    print(color + message + Color.END)

def main():
    HELPALL = """
    请选择要执行的方法：         
                        [+] python  main.py -h  查看帮助
                        [+] python  main.py -x  开启小程序F12              
                        [+] python  main.py -c  开启内置浏览器F12
                        [+] python  main.py -all   开启内置浏览器F12与小程序F12
                        [+] python  main.py -x -t 30  设置30秒后自动恢复内存
                                     
    """
    parser = argparse.ArgumentParser(description=HELPALL, formatter_class=RawTextHelpFormatter)
    parser.add_argument('-x', action='store_true', help='开启小程序F12')
    parser.add_argument('-c', action='store_true', help='开启内置浏览器F12')
    parser.add_argument('-all', action='store_true', help='开启内置浏览器F12与小程序F12')
    parser.add_argument('-t', '--time', type=int, default=15, help='设置自动恢复时间（秒），默认15秒')
    args = parser.parse_args()

    # 设置自动恢复时间
    if args.time != 15:
        commons.set_auto_restore_delay(args.time)

    if args.x:
       commons.load_wechatEx_configs()
    elif args.c:
        commons.load_wechatEXE_configs()
    elif args.all:
        commons.load_wechatEXE_and_wechatEx()
    else:
        print_colored_message(HELPALL, Color.RED)

if __name__ == "__main__":
    generate_banner()
    commons = Commons()
    main()
    
    
