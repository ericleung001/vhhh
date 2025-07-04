// app.js

document.addEventListener('DOMContentLoaded', function() {

    function getAirlineName(code) {
        return airlineCodeMap[code] || code;
    }

    const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const originalDepartureUrl = `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateString}&cargo=true&arrival=false&lang=en`; // 改為請求英文lang=en
    const originalArrivalUrl = `https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateString}&cargo=true&arrival=true&lang=en`; // 改為請求英文lang=en

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
                const [hours, minutes] = flight.time.split(':');
                const flightTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
                return flightTime.getTime() >= (now.getTime() - 1 * 60 * 1000);
            }).slice(0, 5);

            tableBody.innerHTML = ''; 

            if (upcomingFlights.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No upcoming flights at the moment.</td></tr>`;
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
                
                // --- 【關鍵修改】如果 flight.status 是空的，就預設為 'On Time' ---
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
    
    // --- 【關鍵修改】更新函式以匹配英文狀態 ---
    function getStatusCss(statusText) {
        if (typeof statusText !== 'string') return 'status-default';
        const lowerStatus = statusText.toLowerCase();
        
        if (lowerStatus.includes('on time') || lowerStatus.includes('departed')) return 'status-ontime';
        if (lowerStatus.includes('delayed')) return 'status-delayed';
        if (lowerStatus.includes('landed') || lowerStatus.includes('arrived') || lowerStatus.includes('at gate')) return 'status-landed';
        if (lowerStatus.includes('boarding') || lowerStatus.includes('gate closing') || lowerStatus.includes('final call')) return 'status-boarding';
        if (lowerStatus.includes('cancelled')) return 'status-cancelled';
        return 'status-ontime'; // 將預設的(例如我們手動加入的'On Time')也設為綠色
    }

    function updateTimestamp() {
        const now = new Date();
        // --- 【關鍵修改】更新時間戳為英文格式 ---
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
