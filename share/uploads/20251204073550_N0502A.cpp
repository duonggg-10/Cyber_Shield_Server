#include <bits/stdc++.h>
using namespace std;

int main(){
    freopen("N0502A.inp", "r", stdin);
    freopen("N0502A.out", "w", stdout);

    int n;
    cin >>n;
    int mang[n][n];
    int tong;

    for(int i = 1; i <= n; i++) {
        for (int j = 1; j <= n; j++){
            cin >> mang[i][j];
        }
    }

    for(int i = 1; i <= n; i++) {
        for (int j = 1; j <= n; j++){
            tong = tong + mang[i][j];
        }
    }

    cout << tong;
    return 0;
}
