// ══════════════════════════════════════════════════
// ██  SPREADSHEET UPLOAD ENGINE (Shared)           ██
// ██  CSV/XLSX parsing + auto-geocoding            ██
// ══════════════════════════════════════════════════

(function() {
    let uploadedRows = null, uploadHeaders = null, uploadFileName = '';
    let parsedUploadSales = null;
    let _boundaryFeatures = null;
    let _callbacks = {};

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
        .upload-btn { position: absolute; top: 10px; left: 50%; transform: translateX(calc(-50% + 160px)); z-index: 1100; background: linear-gradient(135deg, #ff8800, #ff5500); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; letter-spacing: 0.3px; box-shadow: 0 2px 12px rgba(255,136,0,0.4); transition: all 0.2s; }
        .upload-btn:hover { box-shadow: 0 4px 20px rgba(255,136,0,0.6); filter: brightness(1.1); }
        .upload-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2000; align-items: center; justify-content: center; }
        .upload-overlay.active { display: flex; }
        .upload-modal { background: #0f1420; border: 2px solid #ff8800; border-radius: 12px; padding: 28px; width: 520px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
        .upload-modal h3 { color: #ff8800; font-size: 18px; margin-bottom: 16px; }
        .upload-dropzone { border: 2px dashed #555; border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.3s; margin-bottom: 16px; }
        .upload-dropzone:hover, .upload-dropzone.dragover { border-color: #ff8800; background: rgba(255,136,0,0.05); }
        .upload-dropzone .icon { font-size: 40px; margin-bottom: 8px; }
        .upload-dropzone .main-text { font-size: 15px; color: #ddd; font-weight: 600; }
        .upload-dropzone .sub-text { font-size: 12px; color: #888; margin-top: 6px; }
        .upload-file-input { display: none; }
        .upload-status { font-size: 13px; color: #aaa; margin-top: 12px; min-height: 20px; }
        .upload-status.success { color: #00ff88; }
        .upload-status.error { color: #ff4444; }
        .upload-progress { width: 100%; height: 6px; background: #222; border-radius: 3px; overflow: hidden; margin-top: 8px; display: none; }
        .upload-progress.active { display: block; }
        .upload-progress-bar { height: 100%; background: linear-gradient(90deg, #ff8800, #ff5500); width: 0%; transition: width 0.3s; }
        .upload-results { margin-top: 16px; padding: 12px; background: rgba(255,136,0,0.06); border-radius: 6px; font-size: 12px; display: none; }
        .upload-results.active { display: block; }
        .upload-results .stat-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .upload-results .stat-label { color: #aaa; }
        .upload-results .stat-value { color: #ff8800; font-weight: 700; }
        .upload-close { background: none; border: 1px solid #555; color: #aaa; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; margin-top: 12px; transition: all 0.2s; }
        .upload-close:hover { border-color: #ff8800; color: #ff8800; }
        .upload-apply { background: #ff8800; border: none; color: #000; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; margin-top: 12px; margin-left: 8px; display: none; transition: all 0.2s; }
        .upload-apply.active { display: inline-block; }
        .upload-apply:hover { background: #ffaa33; }
        .upload-col-config { margin-top: 12px; display: none; }
        .upload-col-config.active { display: block; }
        .upload-col-config .col-row { display: flex; align-items: center; margin-bottom: 6px; gap: 8px; }
        .upload-col-config .col-label { font-size: 12px; color: #aaa; width: 80px; }
        .upload-col-config select { background: #1a2235; border: 1px solid #444; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; flex: 1; }
    `;
    document.head.appendChild(style);

    // Inject HTML
    const html = `
    <button class="upload-btn" onclick="window._uploadEngine.open()">📤 Upload Data</button>
    <div class="upload-overlay" id="uploadOverlay" onclick="if(event.target===this)window._uploadEngine.close()">
        <div class="upload-modal">
            <h3>📤 Upload Sales Spreadsheet</h3>
            <div class="upload-dropzone" id="uploadDropzone" onclick="document.getElementById('fileInput').click()">
                <div class="icon">📁</div>
                <div class="main-text">Drop CSV or Excel file here</div>
                <div class="sub-text">Supports .csv, .xlsx, .xls — auto-detects columns<br>Missing ZIPs will be auto-geocoded from lat/lon</div>
            </div>
            <input type="file" id="fileInput" class="upload-file-input" accept=".csv,.xlsx,.xls,.tsv" onchange="window._uploadEngine.handleFile(this.files[0])">
            <div class="upload-col-config" id="colConfig">
                <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Column Mapping</div>
                <div class="col-row"><span class="col-label">Latitude</span><select id="colLat"></select></div>
                <div class="col-row"><span class="col-label">Longitude</span><select id="colLon"></select></div>
                <div class="col-row"><span class="col-label">ZIP Code</span><select id="colZip"></select></div>
                <div class="col-row"><span class="col-label">City</span><select id="colCity"></select></div>
                <div class="col-row"><span class="col-label">Date</span><select id="colDate"></select></div>
            </div>
            <div class="upload-progress" id="uploadProgress"><div class="upload-progress-bar" id="uploadProgressBar"></div></div>
            <div class="upload-status" id="uploadStatus"></div>
            <div class="upload-results" id="uploadResults"></div>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
                <button class="upload-close" onclick="window._uploadEngine.close()">Cancel</button>
                <button class="upload-apply" id="uploadApply">Process Data</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);

    // Drag & drop
    const dz = document.getElementById('uploadDropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files.length) window._uploadEngine.handleFile(e.dataTransfer.files[0]); });

    function showError(msg) {
        document.getElementById('uploadStatus').textContent = msg;
        document.getElementById('uploadStatus').className = 'upload-status error';
        document.getElementById('uploadProgress').classList.remove('active');
    }

    function autoDetectCol(headers, patterns) {
        const lower = headers.map(h => h.toLowerCase().replace(/[_\-\s]/g, ''));
        for (const p of patterns) { const idx = lower.findIndex(h => h === p || h.includes(p)); if (idx >= 0) return idx; }
        return -1;
    }

    function showColumnMapping() {
        document.getElementById('colConfig').classList.add('active');
        const selectors = { colLat: ['latitude','lat'], colLon: ['longitude','lon','lng','long'], colZip: ['zip','zipcode','postalcode','postal'], colCity: ['city','town','municipality','place'], colDate: ['date','saledate','sale_date','created','timestamp'] };
        for (const [selId, patterns] of Object.entries(selectors)) {
            const sel = document.getElementById(selId);
            sel.innerHTML = '<option value="-1">(none)</option>';
            uploadHeaders.forEach((h, i) => { const o = document.createElement('option'); o.value = i; o.textContent = h; sel.appendChild(o); });
            const detected = autoDetectCol(uploadHeaders, patterns);
            if (detected >= 0) sel.value = detected;
        }
        document.getElementById('uploadStatus').textContent = `Loaded ${uploadedRows.length.toLocaleString()} rows, ${uploadHeaders.length} columns from ${uploadFileName}. Verify mapping then click Process.`;
        document.getElementById('uploadStatus').className = 'upload-status';
        const btn = document.getElementById('uploadApply');
        btn.textContent = 'Process Data';
        btn.classList.add('active');
        btn.onclick = processData;
    }

    // Point-in-polygon ray casting
    function pip(lat, lon, coords) {
        for (const poly of coords) {
            for (const ring of poly) {
                let inside = false;
                for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                    const [xi, yi] = ring[i], [xj, yj] = ring[j];
                    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
                }
                if (inside) return true;
            }
        }
        return false;
    }

    function reverseGeocode(lat, lon) {
        if (!_boundaryFeatures) return null;
        for (const feat of _boundaryFeatures.features) {
            const zip = feat.properties.zip || feat.properties.ZCTA5CE10 || feat.properties.GEOID10;
            const geom = feat.geometry;
            const coords = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
            let mnLa=90,mxLa=-90,mnLo=180,mxLo=-180;
            for(const p of coords) for(const r of p) for(const [x,y] of r) { if(y<mnLa)mnLa=y;if(y>mxLa)mxLa=y;if(x<mnLo)mnLo=x;if(x>mxLo)mxLo=x; }
            if (lat < mnLa || lat > mxLa || lon < mnLo || lon > mxLo) continue;
            if (pip(lat, lon, coords)) return zip;
        }
        return null;
    }

    function processData() {
        if (!uploadedRows || !uploadedRows.length) return;
        const latIdx = parseInt(document.getElementById('colLat').value);
        const lonIdx = parseInt(document.getElementById('colLon').value);
        const zipIdx = parseInt(document.getElementById('colZip').value);
        const cityIdx = parseInt(document.getElementById('colCity').value);
        const dateIdx = parseInt(document.getElementById('colDate').value);
        if (latIdx < 0 && zipIdx < 0) { showError('Need at least Latitude or ZIP column mapped'); return; }
        document.getElementById('uploadStatus').textContent = 'Processing records...';
        document.getElementById('uploadProgressBar').style.width = '60%';

        setTimeout(() => {
            const records = [], newZipCounts = {};
            let validZip = 0, geocoded = 0, noLocation = 0;
            const zipValidator = _callbacks.validateZip || (() => true);

            for (let i = 0; i < uploadedRows.length; i++) {
                const row = uploadedRows[i];
                const lat = latIdx >= 0 ? parseFloat(row[latIdx]) : NaN;
                const lon = lonIdx >= 0 ? parseFloat(row[lonIdx]) : NaN;
                let zip = zipIdx >= 0 ? (row[zipIdx]||'').replace(/[^0-9]/g,'') : '';
                const city = cityIdx >= 0 ? (row[cityIdx]||'') : '';
                const date = dateIdx >= 0 ? (row[dateIdx]||'') : '';

                if (zip && zip !== '0') {
                    zip = zip.length <= 5 ? zip.padStart(5,'0') : zip.substring(0,5);
                    if (zipValidator(zip)) {
                        validZip++;
                        records.push([lat||0, lon||0, city, zip, date]);
                        if (!newZipCounts[zip]) newZipCounts[zip] = { n:0, cities: new Set() };
                        newZipCounts[zip].n++; if (city) newZipCounts[zip].cities.add(city);
                        continue;
                    }
                }
                const latRange = _callbacks.latRange || [38, 50];
                const lonRange = _callbacks.lonRange || [-80, -71];
                if (!isNaN(lat) && !isNaN(lon) && lat > latRange[0] && lat < latRange[1] && lon > lonRange[0] && lon < lonRange[1]) {
                    const foundZip = reverseGeocode(lat, lon);
                    if (foundZip) {
                        geocoded++;
                        records.push([lat, lon, city, foundZip, date]);
                        if (!newZipCounts[foundZip]) newZipCounts[foundZip] = { n:0, cities: new Set() };
                        newZipCounts[foundZip].n++; if (city) newZipCounts[foundZip].cities.add(city);
                        continue;
                    }
                }
                noLocation++;
            }

            parsedUploadSales = { records, zipCounts: newZipCounts };
            document.getElementById('uploadProgressBar').style.width = '100%';
            document.getElementById('uploadStatus').textContent = `Processed ${uploadedRows.length.toLocaleString()} rows from ${uploadFileName}`;
            document.getElementById('uploadStatus').className = 'upload-status success';

            const zipCountObj = {};
            for (const [z, d] of Object.entries(newZipCounts)) zipCountObj[z] = { n: d.n, c: [...d.cities].slice(0,3).join(', ') };
            const topZips = Object.entries(zipCountObj).sort((a,b) => b[1].n - a[1].n).slice(0,5);

            const rEl = document.getElementById('uploadResults');
            rEl.innerHTML = `
                <div class="stat-row"><span class="stat-label">Total Usable Records</span><span class="stat-value">${records.length.toLocaleString()}</span></div>
                <div class="stat-row"><span class="stat-label">Valid ZIP from file</span><span class="stat-value">${validZip.toLocaleString()}</span></div>
                <div class="stat-row"><span class="stat-label">Geocoded from lat/lon</span><span class="stat-value" style="color:#00ff88;">${geocoded.toLocaleString()}</span></div>
                <div class="stat-row"><span class="stat-label">Unrecoverable</span><span class="stat-value" style="color:#ff6644;">${noLocation.toLocaleString()}</span></div>
                <div class="stat-row"><span class="stat-label">Unique ZIPs</span><span class="stat-value">${Object.keys(newZipCounts).length}</span></div>
                ${topZips.length ? '<div style="margin-top:8px;font-size:11px;color:#888;">TOP ZIPs:</div>' + topZips.map(([z,d]) => `<div class="stat-row"><span class="stat-label">${z} ${d.c}</span><span class="stat-value">${d.n.toLocaleString()}</span></div>`).join('') : ''}`;
            rEl.classList.add('active');

            const btn = document.getElementById('uploadApply');
            btn.textContent = 'Apply to Map';
            btn.onclick = applyData;
        }, 50);
    }

    function applyData() {
        if (!parsedUploadSales || !_callbacks.onApply) return;
        const { records, zipCounts } = parsedUploadSales;
        const zipData = {};
        for (const [z, d] of Object.entries(zipCounts)) zipData[z] = { n: d.n, c: [...d.cities].slice(0,3).join(', ') };
        _callbacks.onApply(records, zipData);
        window._uploadEngine.close();
    }

    // Public API
    window._uploadEngine = {
        open() { document.getElementById('uploadOverlay').classList.add('active'); },
        close() {
            document.getElementById('uploadOverlay').classList.remove('active');
            document.getElementById('uploadStatus').textContent = '';
            document.getElementById('uploadStatus').className = 'upload-status';
            document.getElementById('uploadResults').classList.remove('active');
            document.getElementById('uploadApply').classList.remove('active');
            document.getElementById('uploadProgress').classList.remove('active');
            document.getElementById('colConfig').classList.remove('active');
        },
        handleFile(file) {
            if (!file) return;
            uploadFileName = file.name;
            const ext = file.name.split('.').pop().toLowerCase();
            document.getElementById('uploadStatus').textContent = `Reading ${file.name} (${(file.size/1024).toFixed(0)} KB)...`;
            document.getElementById('uploadStatus').className = 'upload-status';
            document.getElementById('uploadProgress').classList.add('active');
            document.getElementById('uploadProgressBar').style.width = '20%';
            if (ext === 'csv' || ext === 'tsv') {
                const r = new FileReader();
                r.onload = e => {
                    const lines = e.target.result.split('\n').filter(l => l.trim());
                    if (lines.length < 2) { showError('File appears empty'); return; }
                    const delim = ext === 'tsv' ? '\t' : ',';
                    uploadHeaders = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g,''));
                    uploadedRows = [];
                    for (let i=1;i<lines.length;i++) { const v=lines[i].split(delim).map(x=>x.trim().replace(/^"|"$/g,'')); if(v.length>=uploadHeaders.length-1) uploadedRows.push(v); }
                    document.getElementById('uploadProgressBar').style.width = '50%';
                    showColumnMapping();
                };
                r.readAsText(file);
            } else if (ext === 'xlsx' || ext === 'xls') {
                const r = new FileReader();
                r.onload = e => {
                    try {
                        const wb = XLSX.read(e.target.result, { type: 'array' });
                        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
                        if (data.length < 2) { showError('Sheet appears empty'); return; }
                        uploadHeaders = data[0].map(h => String(h).trim());
                        uploadedRows = data.slice(1).map(r => r.map(v => String(v).trim()));
                        document.getElementById('uploadProgressBar').style.width = '50%';
                        showColumnMapping();
                    } catch(e) { showError('Could not parse Excel file: ' + e.message); }
                };
                r.readAsArrayBuffer(file);
            } else { showError('Unsupported file type. Use .csv, .xlsx, or .xls'); }
        },
        init(opts) {
            // opts: { boundaryUrl, validateZip, latRange, lonRange, onApply }
            _callbacks = opts;
            if (opts.boundaryUrl) {
                fetch(opts.boundaryUrl).then(r => r.ok ? r.json() : null).then(d => { _boundaryFeatures = d; }).catch(() => {});
            }
        }
    };
})();
