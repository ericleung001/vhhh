// app.js

document.addEventListener('DOMContentLoaded', function() {

    const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

    // 輔助函式：從單一航班資訊中，智能地提取出最準確的「有效日期時間」物件
    function getEffectiveFlightTime(flight, status) {
        const today = new Date();
        
        const dateTimeMatch = status.match(/(\d{2}):(\d{2})\s*\((\d{2})\/(\d{2})\/(\d{4})\)/);
        if (dateTimeMatch) {
            const [, hours, minutes, day, month, year] = dateTimeMatch;
            return new Date(year, month - 1, day, hours, minutes);
        }

        const timeMatch = status.match(/(\d{2}):(\d{2})/);
        if (timeMatch) {
            const [hours, minutes] = timeMatch[0].split(':');
            return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
        }

        const [hours, minutes] = flight.time.split(':');
        return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
    }

    function getAirlineName(code) {
        return airlineCodeMap[code] || code;
    }
    
    function getStatusCss(statusText) {
        if (typeof statusText !== 'string') return 'status-default';
        const lowerStatus = statusText.toLowerCase();
        if (lowerStatus.includes('on time') || lowerStatus.includes('departed')) return 'status-ontime';
        if (lowerStatus.includes('delayed') || lowerStatus.includes('est at')) return 'status-delayed';
        if (lowerStatus.includes('landed') || lowerStatus.includes('arrived') || lowerStatus.includes('at gate')) return 'status-landed';
        if (lowerStatus.includes('boarding') || lowerStatus.includes('gate closing') || lowerStatus.includes('final call')) return 'status-boarding';
        if (lowerStatus.includes('cancelled')) return 'status-cancelled';
        return 'status-ontime';
    }

    async function fetchAndDisplayFlights(sourceUrl, tableBodyId, isDeparture) {
        const tableBody = document.getElementById(tableBodyId);
        try {
            const response = await fetch(`${CORS_PROXY}${encodeURIComponent(sourceUrl)}`);
            if (!response.ok) throw new Error(`Network Error: ${response.statusText}`);
            
            const dataText = await response.text();
            const data = JSON.parse(dataText);
            
            const todayForUrl = new Date();
            const dateStringForUrl = `${todayForUrl.getFullYear()}-${String(todayForUrl.getMonth() + 1).padStart(2, '0')}-${String(todayForUrl.getDate()).padStart(2, '0')}`;

            let todaysData;
            if (Array.isArray(data)) {
                todaysData = data.find(dayObject => dayObject.date === dateStringForUrl);
            } else { todaysData = data; }

            if (!todaysData || !todaysData.list) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No flight data available.</td></tr>`;
                return;
            }

            const now = new Date();

            const processedFlights = todaysData.list.map(flight => {
                return { ...flight, effectiveDateTime: getEffectiveFlightTime(flight, flight.status || 'On Time') };
            });

            processedFlights.sort((a, b) => a.effectiveDateTime.getTime() - b.effectiveDateTime.getTime());
            
            const timeWindow = 4 * 60 * 1000; // 你可以修改這裡的時間窗口 (單位：毫秒)
            const lowerBound = now.getTime() - timeWindow;
            
            const displayFlights = processedFlights.filter(flight => {
                if ((flight.status || '').toLowerCase().includes('cancelled')) return false;
                return flight.effectiveDateTime.getTime() >= lowerBound;
            }).slice(0, 5);

            tableBody.innerHTML = ''; 
            if (displayFlights.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No flights to display based on current filters.</td></tr>`;
                return;
            }

            displayFlights.forEach(flight => {
                const status = flight.status || 'On Time';
                
                let displayTime = flight.time;
                const timeInStatus = status.match(/(\d{2}):(\d{2})/);
                if (timeInStatus) { displayTime = timeInStatus[0]; }

                let cleanedStatus = status;
                if (['landed', 'arrived', 'at gate', 'dep '].some(k => cleanedStatus.toLowerCase().startsWith(k))) {
                    const timeInStatusForCleaning = cleanedStatus.match(/\s\d{2}:\d{2}/);
                    if (timeInStatusForCleaning) {
                        cleanedStatus = cleanedStatus.replace(timeInStatusForCleaning[0], '').trim();
                    }
                }

                const displayAirlines = flight.flight?.map(f => getAirlineName(f.airline)).join(' / ') || 'N/A';
                const displayFlightNos = flight.flight?.map(f => f.no).join(' / ') || 'N/A';
                const statusCssClass = getStatusCss(status);
                let displayLocation = isDeparture ? flight.destination?.join(', ') : flight.origin?.join(', ');

                const row = `<tr><td class="flight-time">${displayTime}</td><td>${displayAirlines}</td><td class="flight-no">${displayFlightNos}</td><td>${displayLocation || ''}</td><td style="text-align: center;"><span class="status ${statusCssClass}">${cleanedStatus}</span></td></tr>`;
                tableBody.innerHTML += row;
            });

        } catch (error) {
            console.error(`Failed to fetch flights for ${tableBodyId}:`, error);
            tableBody.innerHTML = `<tr class="error-row"><td colspan="5">Failed to parse flight data. Please try again later.</td></tr>`;
        }
    }

    function updateTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('last-updated').innerText = `Last Updated: ${timeString}`;
    }

    function fetchAllFlights() {
        const todayForUrl = new Date();
        const dateStringForUrl = `${todayForUrl.getFullYear()}-${String(todayForUrl.getMonth() + 1).padStart(2, '0')}-${String(todayForUrl.getDate()).padStart(2, '0')}`;
        
        // --- 【關鍵修改】在這裡為每次請求都產生一個獨一無二的時間戳 ---
        const cacheBuster = `&_=${Date.now()}`;
        
        // 將時間戳附加到原始URL的末尾
        const urls = {
            passengerDeparture: `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=false&arrival=false&lang=en${cacheBuster}`,
            passengerArrival: `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=false&arrival=true&lang=en${cacheBuster}`,
            cargoDeparture: `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=true&arrival=false&lang=en${cacheBuster}`,
            cargoArrival: `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=true&arrival=true&lang=en${cacheBuster}`
        };

        fetchAndDisplayFlights(urls.passengerDeparture, 'departures-body', true);
        fetchAndDisplayFlights(urls.cargoDeparture, 'cargo-departures-body', true);
        fetchAndDisplayFlights(urls.passengerArrival, 'arrivals-body', false);
        fetchAndDisplayFlights(urls.cargoArrival, 'cargo-arrivals-body', false);
        updateTimestamp();
    }

    // 立即執行並設定每分鐘刷新
    fetchAllFlights();
    setInterval(fetchAllFlights, 60000);
});
