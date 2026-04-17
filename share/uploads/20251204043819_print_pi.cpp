#include <bits/stdc++.h>
using namespace std;
using BigInt = long double;

BigInt compute_pi(long long n) {
    BigInt pi = 0.0;
    for (long long k = 0; k < n; k++) {
        BigInt up = pow(-1, k) * tgamma(6*k + 1) * (13591409 + 545140134*k);
        BigInt down = tgamma(3*k + 1) * pow(tgamma(k + 1), 3) * pow(640320, 3*k + 1.5);
        pi += up / down;
    }
    pi = pi * 12.0;
    return 1.0 / pi;
}

int main() {
    long long terms = 5000000000000; // muốn nặng tăng số này
    auto start = chrono::high_resolution_clock::now();
    BigInt pi = compute_pi(terms);
    auto end = chrono::high_resolution_clock::now();
    cout << "Done in "
         << chrono::duration<double>(end - start).count()
         << "s\n";
}
