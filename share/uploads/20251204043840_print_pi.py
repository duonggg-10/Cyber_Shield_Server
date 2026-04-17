# Stress test CPU bằng thuật toán Chudnovsky (tính Pi)
from decimal import Decimal, getcontext
import math
import time

# 5 triệu chữ số → đủ để máy nóng, không làm crash
digits = 5_000_000_000
getcontext().prec = digits

def compute_pi(n_terms=6000):
    pi = Decimal(0)
    k = Decimal(0)
    for i in range(n_terms):
        pi += (Decimal((-1)**i) * math.factorial(6*i) *
               (13591409 + 545140134*i)) / \
              (math.factorial(3*i) * (math.factorial(i)**3) *
               (Decimal(640320)**(3*i + Decimal(3)/2)))
    pi = pi * Decimal(12)
    pi = 1 / pi
    return pi

start = time.time()
pi = compute_pi()
end = time.time()

print("Done in:", end - start, "seconds")
