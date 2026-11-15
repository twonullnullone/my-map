from http.server import HTTPServer, SimpleHTTPRequestHandler 
 
class CORSHandler(SimpleHTTPRequestHandler): 
    def end_headers(self): 
        self.send_header("Access-Control-Allow-Origin", "*") 
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS") 
        self.send_header("Access-Control-Allow-Headers", "*") 
        super().end_headers() 
 
    def do_OPTIONS(self): 
        self.send_response(200) 
        self.end_headers() 
 
print("Сервер запущен: http://localhost:8000") 
HTTPServer(("0.0.0.0", 8000), CORSHandler).serve_forever() 
