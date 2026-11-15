@echo off
title Map Server (CORS)
cd /d "%~dp0"

echo from http.server import HTTPServer, SimpleHTTPRequestHandler > temp_server.py
echo. >> temp_server.py
echo class CORSHandler(SimpleHTTPRequestHandler): >> temp_server.py
echo     def end_headers(self): >> temp_server.py
echo         self.send_header("Access-Control-Allow-Origin", "*") >> temp_server.py
echo         self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS") >> temp_server.py
echo         self.send_header("Access-Control-Allow-Headers", "*") >> temp_server.py
echo         super().end_headers() >> temp_server.py
echo. >> temp_server.py
echo     def do_OPTIONS(self): >> temp_server.py
echo         self.send_response(200) >> temp_server.py
echo         self.end_headers() >> temp_server.py
echo. >> temp_server.py
echo print("Сервер запущен: http://localhost:8000") >> temp_server.py
echo HTTPServer(("0.0.0.0", 8000), CORSHandler).serve_forever() >> temp_server.py

python temp_server.py

del temp_server.py
pause