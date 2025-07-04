// app.js

// 當HTML文檔完全載入並解析後執行
document.addEventListener('DOMContentLoaded', function() {

    // 輔助函式：根據ICAO代碼獲取航空公司全名
    // 它會使用在 airlines.js 中定義的全局變數 airlineCodeMap
    function getAirlineName(code) {
        return airlineCodeMap[code] || code; // 如果在對照表中找不到，就直接返回原始代碼
    }

    const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const originalDepartureUrl = `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateString}&cargo=false&arrival=false&lang=zh_HK`;
    const originalArrivalUrl = `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateString}&cargo=false&arrival=true&lang=zh_HK`;

    const departureUrl = `${CORS_PROXY}${encodeURIComponent(originalDepartureUrl)}`;
    const arrivalUrl = `${CORS_PROXY}${encodeURIComponent(originalArrivalUrl)}`;

    async function fetchFlights(url, tableBodyId, isDeparture) {
        const tableBody = document.getElementById(tableBodyId);
        try {
            const response = await fetch(url);
            if (!response.ok) { throw new Error(`網絡錯誤: ${response.statusText}`); }
            
            const dataText = await response.text();
            const data = JSON.parse(dataText);
            
            const todaysData = data.find(dayObject => dayObject.date === dateString);

            if (!todaysData || !todaysData.list) {
                throw new Error("在API回應中找不到今天的航班列表 ('list')");
            }

            const flightList = todaysData.list;

            const now = new Date();
            const upcomingFlights = flightList.filter(flight => {
                const [hours, minutes] = flight.time.split(':');
                const flightTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
                return flightTime.getTime() >= (now.getTime() - 10 * 60 * 1000);
            }).slice(0, 5);

            tableBody.innerHTML = ''; 

            if (upcomingFlights.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">暫時沒有更多即將來臨的航班。</td></tr>`;
                return;
            }

            upcomingFlights.forEach(flight => {
                const displayTime = flight.time || 'N/A';
                
                let displayAirlines = 'N/A';
                if (flight.flight && flight.flight.length > 0) {
                    displayAirlines = flight.flight.map(f => getAirlineName(f.airline)).join(' / ');
                }

                let displayFlightNos = 'N/A';
                if (flight.flight && flight.flight.length > 0) {
                    displayFlightNos = flight.flight.map(f => f.no).join(' / ');
                }
                
                const displayStatus = flight.status || 'N/A';
                const statusCssClass = getStatusCss(displayStatus);

                let displayLocation = '';
                if (isDeparture && flight.destination && flight.destination.length > 0) {
                    displayLocation = flight.destination.join(', ');
                } else if (!isDeparture && flight.origin && flight.origin.length > 0) {
                    displayLocation = flight.origin.join(', ');
                }

                const row = `
                    <tr>
                        <td class="flight-time">${displayTime}</td>
                        <td>${displayAirlines}</td>
                        <td class="flight-no">${displayFlightNos}</td>
                        <td>${displayLocation}</td>
                        <td style="text-align: center;"><span class="status ${statusCssClass}">${displayStatus}</span></td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });

        } catch (error) {
            console.error(`獲取 ${isDeparture ? '出發' : '到達'} 航班資料失敗:`, error);
            tableBody.innerHTML = `<tr class="error-row"><td colspan="5">無法正確解析航班資料。請稍後再試。</td></tr>`;
        }
    }
    
    function getStatusCss(statusText) {
        if (typeof statusText !== 'string') return 'status-default';
        if (statusText.includes('準時') || statusText.includes('啟航')) return 'status-ontime';
        if (statusText.includes('延誤')) return 'status-delayed';
        if (statusText.includes('已到達') || statusText.includes('到閘口')) return 'status-landed';
        if (statusText.includes('登機') || statusText.includes('截止')) return 'status-boarding';
        if (statusText.includes('取消')) return 'status-cancelled';
        return 'status-default';
    }

    function updateTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('last-updated').innerText = `最後更新: ${timeString}`;
    }

    fetchFlights(departureUrl, 'departures-body', true);
    fetchFlights(arrivalUrl, 'arrivals-body', false);
    updateTimestamp();

    setInterval(() => {
        fetchFlights(departureUrl, 'departures-body', true);
        fetchFlights(arrivalUrl, 'arrivals-body', false);
        updateTimestamp();
    }, 60000);
});