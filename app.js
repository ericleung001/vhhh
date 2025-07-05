// app.js

document.addEventListener('DOMContentLoaded', function() {

    function getAirlineName(code) {
        return airlineCodeMap[code] || code;
    }

    const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const originalDepartureUrl = `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateString}&cargo=true&arrival=false&lang=en`;
    const originalArrivalUrl = `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateString}&cargo=true&arrival=true&lang=en`;

    const departureUrl = `${CORS_PROXY}${encodeURIComponent(originalDepartureUrl)}`;
    const arrivalUrl = `${CORS_PROXY}${encodeURIComponent(originalArrivalUrl)}`;

    async function fetchFlights(url, tableBodyId, isDeparture) {
        const tableBody = document.getElementById(tableBodyId);
        try {
            const response = await fetch(url);
            if (!response.ok) { throw new Error(`Network Error: ${response.statusText}`); }
            
            const dataText = await response.text();
            const data = JSON.parse(dataText);
            
            const todaysData = data.find(dayObject => dayObject.date === dateString);

            if (!todaysData || !todaysData.list) {
                throw new Error("Today's flight list ('list') not found in API response");
            }

            const flightList = todaysData.list;

            const now = new Date();
            const upcomingFlights = flightList.filter(flight => {
                const status = flight.status || 'On Time';
                const lowerStatus = status.toLowerCase();

                // 1. 過濾已取消的航班
                if (lowerStatus.includes('cancelled')) {
                    return false;
                }
                
                // --- 【關鍵修正】智能提取「有效時間」---
                let effectiveTimeString = flight.time; // 預設使用「預定時間」
                
                // 使用正規表示式，嘗試從狀態文字中找出 HH:MM 格式的時間
                const timeInStatusMatch = status.match(/(\d{2}):(\d{2})/);
                
                if (timeInStatusMatch) {
                    // 如果找到了 (例如從 "Landed 09:17" 中找到 "09:17")，就用這個時間覆蓋預設值
                    effectiveTimeString = timeInStatusMatch[0];
                }
                
                // 2. 使用最準確的「有效時間」來進行過濾
                const [hours, minutes] = effectiveTimeString.split(':');
                const effectiveFlightTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);

                if (lowerStatus.includes('landed') || lowerStatus.includes('arrived') || lowerStatus.includes('at gate')) {
                    // 「已到達」的航班，在2分鐘後消失
                    return effectiveFlightTime.getTime() >= (now.getTime() - 5 * 60 * 1000);
                } else {
                    // 其他狀態的航班，在1分鐘後消失
                    return effectiveFlightTime.getTime() >= (now.getTime() - 5 * 60 * 1000);
                }

            }).slice(0, 10);

            tableBody.innerHTML = ''; 

            if (upcomingFlights.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No upcoming flights to display.</td></tr>`;
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
                
                const displayStatus = flight.status || 'On Time';
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
            console.error(`Failed to fetch ${isDeparture ? 'departure' : 'arrival'} flights:`, error);
            tableBody.innerHTML = `<tr class="error-row"><td colspan="5">Failed to parse flight data. Please try again later.</td></tr>`;
        }
    }
    
    function getStatusCss(statusText) {
        if (typeof statusText !== 'string') return 'status-default';
        const lowerStatus = statusText.toLowerCase();
        
        if (lowerStatus.includes('on time') || lowerStatus.includes('departed')) return 'status-ontime';
        if (lowerStatus.includes('delayed')) return 'status-delayed';
        if (lowerStatus.includes('landed') || lowerStatus.includes('arrived') || lowerStatus.includes('at gate')) return 'status-landed';
        if (lowerStatus.includes('boarding') || lowerStatus.includes('gate closing') || lowerStatus.includes('final call')) return 'status-boarding';
        if (lowerStatus.includes('cancelled')) return 'status-cancelled';
        return 'status-ontime';
    }

    function updateTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        document.getElementById('last-updated').innerText = `Last Updated: ${timeString}`;
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
