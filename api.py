import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import subprocess
import platform
import json


class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 解析URL和查询参数
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query_params = parse_qs(parsed_path.query)

        if path == '/click':
            # 获取坐标参数
            x = query_params.get('x', [None])[0]
            y = query_params.get('y', [None])[0]

            # 验证坐标参数
            if x is not None and y is not None:
                try:
                    x = int(x)
                    y = int(y)
                    logging.log(logging.INFO, f"Clicking at position ({x}, {y})")

                    # 模拟点击坐标位置
                    success = self.simulate_click(x, y)

                    if success:
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        response = {
                            "status": "success",
                            "message": f"Clicked at position ({x}, {y})"
                        }
                        self.wfile.write(json.dumps(response).encode())
                    else:
                        self.send_response(500)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        response = {
                            "status": "error",
                            "message": "Failed to simulate click"
                        }
                        self.wfile.write(json.dumps(response).encode())

                except ValueError:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    response = {
                        "status": "error",
                        "message": "Invalid coordinates. x and y must be integers."
                    }
                    self.wfile.write(json.dumps(response).encode())
            else:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                response = {
                    "status": "error",
                    "message": "Missing x or y parameter. Use /click?x=100&y=200"
                }
                self.wfile.write(json.dumps(response).encode())
    def simulate_click(self, x, y):
        """
        根据操作系统模拟鼠标点击
        """
        system = platform.system()
        try:
            if system == "Windows":
                # Windows使用pyautogui (需要pip install pyautogui)
                import pyautogui
                pyautogui.click(x, y)
            elif system == "Darwin":  # macOS
                # 使用AppleScript
                script = f'''
                tell application "System Events"
                    click at {{{x}, {y}}}
                end tell
                '''
                subprocess.run(["osascript", "-e", script], check=True)
            else:  # Linux
                # 使用xdotool (需要安装: sudo apt-get install xdotool)
                subprocess.run(["xdotool", "mousemove", str(x), str(y), "click", "1"], check=True)
            return True
        except Exception as e:
            print(f"Error simulating click: {e}")
            return False

    # 禁用日志输出
    def log_message(self, format, *args):
        pass


def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)
    print(f"Server running on http://localhost:{port}")
    print("Endpoints:")
    print("  GET / - Home page with click form")
    print("  GET /click?x=<x>&y=<y> - Click at specified coordinates")
    httpd.serve_forever()


if __name__ == '__main__':
    run_server()
