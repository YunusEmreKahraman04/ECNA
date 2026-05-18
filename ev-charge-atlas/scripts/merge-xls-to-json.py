import os
import glob
import json
import pandas as pd

def is_numeric(val):
    try:
        float(str(val).replace(',', '.').strip())
        return True
    except:
        return False

def clean_power(val):
    try:
        return float(str(val).replace(',', '.').strip())
    except:
        return 0.0

def merge():
    json_input_path = 'ECNA-main/ev-charge-atlas/public/data/stations.json'
    existing_stations = []
    brand_prices = {}

    if os.path.exists(json_input_path):
        with open(json_input_path, 'r', encoding='utf-8') as f:
            existing_stations = json.load(f)
            for s in existing_stations:
                brand = s.get('marka')
                if brand:
                    brand_prices[brand] = (s.get('ac_fiyat'), s.get('dc_fiyat'))
        print(f"Loaded {len(existing_stations)} existing stations from stations.json")

    xls_files = glob.glob('ECNA-main/sarjIstasyonlari (1)/*.xls')
    print(f"Found {len(xls_files)} XLS files to process.")

    xls_stations = {}
    
    for f in sorted(xls_files):
        try:
            df = pd.read_excel(f)
            if df.shape[1] < 11:
                print(f"Skipping {f} because columns count is {df.shape[1]} < 11")
                continue

            current_station = None
            for _, row in df.iterrows():
                # Read ID
                s_id = row.iloc[1]
                if isinstance(s_id, str) and ('RJ' in s_id or 'rj' in s_id.lower() or '' in s_id):
                    # Clean and normalize ID to "ŞRJ/XXXX"
                    cleaned_id = str(s_id).strip()
                    if '/' in cleaned_id:
                        num = cleaned_id.split('/')[-1].strip()
                        cleaned_id = f"ŞRJ/{num}"
                    
                    name = row.iloc[2]
                    hizmet = row.iloc[3]
                    marka = row.iloc[4]
                    yesil = row.iloc[7]
                    adres = row.iloc[8]

                    # Parse city from address (usually: "... District / CITY")
                    city = "TURKIYE"
                    if isinstance(adres, str) and '/' in adres:
                        city = adres.split('/')[-1].strip().upper()
                        # Clean special characters in Turkish city names
                        city = "".join(c for c in city if c.isalpha() or c == ' ').strip()
                    
                    is_green = False
                    if isinstance(yesil, str):
                        is_green = (yesil.strip().lower() in ['evet', 'yes', 'true', '1'])

                    # Reuse existing prices if available, otherwise default
                    brand_str = str(marka).strip() if pd.notna(marka) else ""
                    ac_p, dc_p = brand_prices.get(brand_str, (9.49, 12.99))

                    current_station = {
                        "id": cleaned_id,
                        "ad": str(name).strip() if pd.notna(name) else "",
                        "hizmet": str(hizmet).strip() if pd.notna(hizmet) else "",
                        "marka": brand_str,
                        "adres": str(adres).strip() if pd.notna(adres) else "",
                        "sehir": city,
                        "yesil": is_green,
                        "ac_fiyat": ac_p,
                        "dc_fiyat": dc_p,
                        "sockets": []
                    }
                    xls_stations[cleaned_id] = current_station

                # Parse socket details (Unnamed: 10, Unnamed: 11, Unnamed: 12)
                if current_station is not None:
                    s_tip = row.iloc[10]
                    s_tur = row.iloc[11]
                    s_guc = row.iloc[12]

                    if pd.notna(s_tip) or pd.notna(s_tur) or pd.notna(s_guc):
                        current_station["sockets"].append({
                            "tipi": str(s_tip).strip() if pd.notna(s_tip) else "",
                            "turu": str(s_tur).strip() if pd.notna(s_tur) else "",
                            "gucu": clean_power(s_guc)
                        })

        except Exception as e:
            print(f"Error reading file {f}: {e}")

    # Process and summarize socket columns for the XLS stations
    processed_xls = []
    for s_id, s in xls_stations.items():
        sockets = s["sockets"]
        s["soket_sayisi"] = len(sockets) if sockets else 1
        
        powers = [sk["gucu"] for sk in sockets if sk["gucu"] > 0]
        s["max_guc"] = int(max(powers)) if powers else 22
        
        summary_parts = []
        has_ac = False
        has_dc = False
        
        for sk in sockets:
            tip = sk["tipi"].upper()
            if "AC" in tip:
                has_ac = True
            elif "DC" in tip:
                has_dc = True
            
            turu = sk["turu"]
            guc = sk["gucu"]
            if turu and guc > 0:
                guc_str = f"{int(guc)}" if guc.is_integer() else f"{guc}"
                part = f"{turu} {guc_str}kW"
                if part not in summary_parts:
                    summary_parts.append(part)
        
        s["has_ac"] = has_ac
        s["has_dc"] = has_dc
        
        if not sockets:
            s["has_ac"] = True
            s["has_dc"] = False
            s["soket_ozet"] = "AC_TYPE2 22kW"
        else:
            s["soket_ozet"] = ", ".join(summary_parts)
            
        del s["sockets"]
        processed_xls.append(s)

    print(f"Successfully processed {len(processed_xls)} unique stations from XLS files.")

    # Merge existing and XLS stations based on ID
    merged_map = {s["id"]: s for s in existing_stations}
    new_count = 0
    
    for s in processed_xls:
        s_id = s["id"]
        if s_id not in merged_map:
            merged_map[s_id] = s
            new_count += 1
        else:
            # Update socket details and green flag if they changed
            merged_map[s_id].update({
                "yesil": s["yesil"],
                "soket_ozet": s["soket_ozet"],
                "soket_sayisi": s["soket_sayisi"],
                "max_guc": s["max_guc"],
                "has_ac": s["has_ac"],
                "has_dc": s["has_dc"]
            })

    final_list = list(merged_map.values())
    print(f"Merged stations list size: {len(final_list)} (Added {new_count} brand-new stations)")

    # Save to stations.json
    with open(json_input_path, 'w', encoding='utf-8') as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)
    print(f"Successfully wrote {len(final_list)} stations to {json_input_path}!")

if __name__ == '__main__':
    merge()
