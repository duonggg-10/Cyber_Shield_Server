#include <bits/stdc++.h>
using namespace std;

int main(){
	freopen("MAXPRIME.INP", "r", stdin);
	freopen("MAXPRIME.OUT", "w", stdout);

	int n;
	cin >> n;
	int lon_nhat = 0;
	//cout << n << endl;

    for (int i = 1; i < n; i++){
        if (n % i == 0){
            //cout << i << " la thua so nguyen to cua " << n << endl;
            if (i > lon_nhat){
                lon_nhat = i;
            }
        }
    }

    cout << lon_nhat;

	return 0;
}
