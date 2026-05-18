import os
import glob
import json
import pandas as pd

def analyze():
    existing_path = 'ECNA-main/ev-charge-atlas/public/data/stations.geocoded.json'
    existing_ids = set()
    if os.path.exists(existing_path):
        with open(existing_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            existing_ids = {s['id'].strip() for s in data}
    print(f"Existing geocoded stations in JSON: {len(existing_ids)}")

    xls_files = glob.glob('ECNA-main/sarjIstasyonlari (1)/*.xls')
    print(f"Found {len(xls_files)} XLS files in folder.")

    xls_stations = {}
    for f in sorted(xls_files):
        try:
            df = pd.read_excel(f)
            # Find station columns
            # EPDK columns: Sıra No, İstasyon No, İstasyon Adı, Hizmet Şekli, Marka, Şarj Ağ İşletmecisi, Şarj İstasyonu İşletmecisi, Yeşil Şarj İstasyonu mu, Adres, Soket Bilgileri...
            # Standard index matching:
            # col 1 (idx 1): İstasyon No
            # col 2 (idx 2): İstasyon Adı
            # col 3 (idx 3): Hizmet Şekli
            # col 4 (idx 4): Marka
            # col 8 (idx 8): Adres
            if df.shape[1] >= 9:
                for idx, row in df.iterrows():
                    station_id = row.iloc[1]
                    if isinstance(station_id, str) and ('RJ' in station_id or 'rj' in station_id.lower()):
                        station_id = station_id.strip()
                        # This is a main row containing station metadata!
                        name = row.iloc[2]
                        hizmet = row.iloc[3]
                        marka = row.iloc[4]
                        yesil = row.iloc[7]
                        adres = row.iloc[8]
                        
                        # Handle operator and green flag
                        is_green = False
                        if isinstance(yesil, str):
                            is_green = (yesil.strip().lower() in ['evet', 'yes', 'true', '1'])
                        
                        xls_stations[station_id] = {
                            "id": station_id,
                            "ad": str(name).strip() if pd.notna(name) else "",
                            "hizmet": str(hizmet).strip() if pd.notna(hizmet) else "",
                            "marka": str(marka).strip() if pd.notna(marka) else "",
                            "adres": str(adres).strip() if pd.notna(adres) else "",
                            "yesil": is_green,
                            "sockets": []
                        }
                    
                    # Socket details (could be on the main row or subsequent rows)
                    current_station_id = None
                    # Find closest preceding station_id
                    # But pandas lets us forward-fill the station info or keep track of the active station!
        except Exception as e:
            print(f"Error reading {f}: {e}")

    print(f"Total unique stations parsed from XLS: {len(xls_stations)}")
    
    missing_ids = set(xls_stations.keys()) - existing_ids
    print(f"Number of missing stations: {len(missing_ids)}")
    
    if missing_ids:
        print("Sample missing stations:")
        for idx in list(missing_ids)[:10]:
            print(f" - {idx}: {xls_stations[idx]['ad']} at {xls_stations[idx]['adres']}")

if __name__ == '__main__':
    analyze()
