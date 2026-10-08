#!/bin/bash

# Script untuk menjalankan load test bertahap: 1, 10, 20, 50, 100 user
# Setiap tahap akan menghasilkan file JSON terpisah untuk analisis

echo "🚀 Starting staged load testing..."
echo "======================================"

# Pastikan server Next.js berjalan
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Error: Server Next.js tidak berjalan di localhost:3000"
    echo "   Jalankan 'npm run dev' terlebih dahulu di terminal lain."
    exit 1
fi

# Buat folder hasil
mkdir -p results

# Array jumlah VU untuk setiap tahap
VUS_LIST=(1 10 20 50 100)
DURATION="2m"

for VUS in "${VUS_LIST[@]}"; do
    echo ""
    echo "📊 Testing with $VUS Virtual Users..."
    echo "--------------------------------------"
    
    # Jalankan k6 dengan VU spesifik, simpan ke file JSON terpisah
    k6 run \
        --env VUS=$VUS \
        --env DURATION=$DURATION \
        --out json=results/stage_${VUS}vus.json \
        --summary-export=results/stage_${VUS}vus_summary.json \
        load-test.js
    
    echo "✅ Stage $VUS VUs completed. Results saved to results/stage_${VUS}vus*"
    echo ""
    
    # Jeda 30 detik antar tahap agar server "bernapas"
    if [ "$VUS" != "100" ]; then
        echo "⏳ Cooling down for 30 seconds..."
        sleep 30
    fi
done

echo ""
echo "🎉 All stages completed!"
echo "📁 Results are in: ./results/"
echo ""
echo "Files generated:"
ls -la results/