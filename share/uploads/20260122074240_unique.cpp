#include <bits/stdc++.h>
using namespace std;

int cnt[1000001];   // khai báo m?ng d?m (gi? s? mã = 10^6)

int main() {
    freopen("unique.inp", "r", stdin);
    freopen("unique.out", "w", stdout);

	int n;
	cin >> n;

    int x;
    for (int i = 0; i < n; i++) {
        cin >> x;
        cnt[x]++;
    }

    for (int i = 0; i <= 1000000; i++) {
        if (cnt[i] == 1) {
            cout << i;
            break;
        }
    }

    return 0;
}

