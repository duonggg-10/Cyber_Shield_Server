def in_tam_giac_so(n):
    for i in range(1, n + 1):
        # 1. In khoảng trắng ở đầu mỗi dòng để tạo độ cân (căn lề phải)
        # Mỗi số thường cách nhau 1 khoảng trắng, nên ta nhân 3 để tam giác đẹp hơn
        print(" " * (n - i), end="")

        # 2. In dãy số giảm dần từ i về 1
        for j in range(i, 0, -1):
            print(j, end=" ")

        # 3. In dãy số tăng dần từ 2 đến i
        for j in range(2, i + 1):
            print(j, end=" ")

        # Xuống dòng sau khi in xong một hàng
        print()

# Nhập số dòng từ bàn phím
try:
    n = int(input("Nhập số dòng n: "))
    if n > 0:
        in_tam_giac_so(n)
    else:
        print("Vui lòng nhập số nguyên dương!")
except ValueError:
    print("Vui lòng nhập một số nguyên!")
