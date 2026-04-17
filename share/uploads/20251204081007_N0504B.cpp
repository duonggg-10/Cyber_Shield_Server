#include <bits/stdc++.h>
using namespace std;

int main() {
    freopen("N0504B.inp", "r", stdin);
    freopen("N0504B.out", "w", stdout);

    int n;
    cin >> n;
    int mang[n][n];

    for (int i = 0; i < n; i++){
        for (int j = 0; j < n; j++){
            cin >> mang[i][j];
        }
    }

    int cot[100];

    for (int j = 0; j < n; j++){
        cot[j] = 0;
        for (int i = 0; i < n; i++){
            cot[j] += mang[i][j];
        }
    }
    int maxCot = cot[0];
    for (int j = 1; j < n; j++){
        if (cot[j] > maxCot){
            maxCot = cot[j];
        }
    }

    cout << maxCot;

    return 0;
}
