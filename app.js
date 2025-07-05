// app.js

document.addEventListener('DOMContentLoaded', function() {

    function getEffectiveFlightTime(flight) {
        const today = new Date();
        const status = flight.status || '';
        
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

    const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
    const todayForUrl = new Date();
    const dateStringForUrl = `${todayForUrl.getFullYear()}-${String(todayForUrl.getMonth() + 1).padStart(2, '0')}-${String(todayForUrl.getDate()).padStart(2, '0')}`;

    const passengerDepartureUrl = `${CORS_PROXY}${encodeURIComponent(`https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=false&arrival=false&lang=en`)}`;
    const passengerArrivalUrl = `${CORS_PROXY}${encodeURIComponent(`https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=false&arrival=true&lang=en`)}`;
    const cargoDepartureUrl = `${CORS_PROXY}${encodeURIComponent(`https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=true&arrival=false&lang=en`)}`;
    const cargoArrivalUrl = `${CORS_PROXY}${encodeURIComponent(`https://www.hongkongairport.com/flightinfo-rest/rest/flights/past?date=${dateStringForUrl}&cargo=true&arrival=true&lang=en`)}`;


    async function fetchFlights(url, tableBodyId, isDeparture) {
        const tableBody = document.getElementById(tableBodyId);
        try {
            const response = await fetch(url);
            if (!response.ok) { throw new Error(`Network Error: ${response.statusText}`); }
            
            const dataText = await response.text();
            const data = JSON.parse(dataText);
            
            // --- 【關鍵修正】讓程式能同時處理兩種不同的資料格式 ---
            let todaysData;
            
            // 檢查API回傳的是否為陣列 (客機API格式)
            if (Array.isArray(data)) {
                todaysData = data.find(dayObject => dayObject.date === dateStringForUrl);
            } else {
                // 如果不是陣列，就假設它是單一物件 (很可能是貨機API格式)
                todaysData = data;
            }
            // --- 修正結束 ---

            if (!todaysData || !todaysData.list) {
                tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No flight data available.</td></tr>`;
                return;
            }

            const flightList = todaysData.list;
            const now = new Date();

            const upcomingFlights = flightList
                .filter(flight => {
                    const status = flight.status || '-';
                    const lowerStatus = status.toLowerCase();

                    if (lowerStatus.includes('cancelled')) {
                        return false;
                    }
                    
                    const effectiveFlightTime = getEffectiveFlightTime(flight);
                    
                    if (lowerStatus.includes('landed') || lowerStatus.includes('arrived') || lowerStatus.includes('at gate')) {
                        return effectiveFlightTime.getTime() >= (now.getTime() - 1 * 60 * 1000);
                    } else {
                        return effectiveFlightTime.getTime() >= (now.getTime() - 1 * 60 * 1000);
                    }
                })
                .sort((flightA, flightB) => {
                    const timeA = getEffectiveFlightTime(flightA).getTime();
                    const timeB = getEffectiveFlightTime(flightB).getTime();
                    return timeA - timeB;
                })
                .slice(0, 5);

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
                
                const displayStatus = flight.status || '-';
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
            console.error(`Failed to fetch flights for ${tableBodyId}:`, error);
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

    function fetchAllFlights() {
        fetchFlights(passengerDepartureUrl, 'departures-body', true);
        fetchFlights(cargoDepartureUrl, 'cargo-departures-body', true);
        fetchFlights(passengerArrivalUrl, 'arrivals-body', false);
        fetchFlights(cargoArrivalUrl, 'cargo-arrivals-body', false);
        updateTimestamp();
    }

    fetchAllFlights();

    setInterval(() => {
        console.log("Auto-refreshing all flight data...");
        fetchAllFlights();
    }, 60000);
});
