// Localized arrays to avoid heavy formatting libraries
const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// DOM Cache
const title = document.getElementById('month-year');
const calGrid = document.getElementById('calGrid');
const dayContainer = document.getElementById('dayContainer');
const dayContainerTitle = document.getElementById('dayContainerTitle');
const miscContainer = document.getElementById('miscContainer');

let events = [];
let indexedEvents = {}; // O(1) Lookup cache: { "YYYY-MM-DD": [events...] }

// Helper: Format Date to YYYY-MM-DD safely without timezones shifting the day
const toIsoDateStr = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Indexing function to turn O(N) searches into O(1) lookups
const indexEvents = (eventList) => {
    indexedEvents = {};
    for (let i = 0; i < eventList.length; i++) {
        const ev = eventList[i];
        if (ev.start.date) {
            // All-day event (handle multi-day ranges)
            let current = new Date(ev.start.date);
            const end = new Date(ev.end.date);
            while (current < end) {
                const dateStr = toIsoDateStr(current);
                if (!indexedEvents[dateStr]) indexedEvents[dateStr] = [];
                indexedEvents[dateStr].push(ev);
                current.setDate(current.getDate() + 1);
            }
        } else if (ev.start.dateTime) {
            // Timed event
            const dateStr = ev.start.dateTime.split('T')[0];
            if (!indexedEvents[dateStr]) indexedEvents[dateStr] = [];
            indexedEvents[dateStr].push(ev);
        }
    }
};

// Setup current state using simple timestamps
let currentCalendarDate = new Date();
let selectedDay = new Date();
const todayStr = toIsoDateStr(new Date());

const drawCalendar = (calDate) => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();

    title.textContent = `${MONTHS_IT[month]} ${year}`;

    // Find the first Monday on or before the 1st of the month
    let pivot = new Date(year, month, 1);
    let dayOfWeek = pivot.getDay(); 
    let daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Monday=1 layout
    pivot.setDate(pivot.getDate() - daysToSubtract);

    let html = `
        <div class="day-name">L</div><div class="day-name">M</div><div class="day-name">M</div>
        <div class="day-name">G</div><div class="day-name">V</div><div class="day-name">S</div>
        <div class="day-name">D</div>
    `;

    const selectedStr = selectedDay ? toIsoDateStr(selectedDay) : '';

    // Render exactly 35 grid slots
    for (let i = 0; i < 35; i++) {
        const dateStr = toIsoDateStr(pivot);
        const isCurrentMonth = pivot.getMonth() === month;
        const hasEvts = indexedEvents[dateStr] && indexedEvents[dateStr].length > 0;

        let classes = 'calendar-day';
        if (!isCurrentMonth) classes += ' empty';
        if (dateStr === todayStr) classes += ' active';
        if (dateStr === selectedStr) classes += ' selected';

        html += `<div data-date="${dateStr}" class="${classes}">${pivot.getDate()}${hasEvts ? '<span class="dot"></span>' : ''}</div>`;
        
        pivot.setDate(pivot.getDate() + 1); // Mutate to save allocations
    }

    calGrid.innerHTML = html;
};

function drawDayContainer() {
    if (!selectedDay) return;
    
    dayContainer.classList.add('open');
    const dateStr = toIsoDateStr(selectedDay);
    
    // Reverse display format DD/MM/YYYY
    const parts = dateStr.split('-');
    dayContainerTitle.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;

    const todayEvents = indexedEvents[dateStr] || [];
    let html = '';
    
    for (let i = 0; i < todayEvents.length; i++) {
        const ev = todayEvents[i];
        if (ev.start.dateTime) {
            const tStart = ev.start.dateTime.substring(11, 16);
            const tEnd = ev.end.dateTime.substring(11, 16);
            html += `<span>[${tStart} - ${tEnd}] ${ev.summary}</span>`;
        } else {
            html += `<span>[All day] ${ev.summary}</span>`;
        }
    }
    dayContainer.innerHTML = html;
}

// Navigation Actions
const changeMonth = (offset) => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
    drawCalendar(currentCalendarDate);
};

document.getElementById('prevButton').addEventListener('click', () => changeMonth(-1));
document.getElementById('nextButton').addEventListener('click', () => changeMonth(1));
document.getElementById('todayButton').addEventListener('click', () => {
    currentCalendarDate = new Date();
    selectedDay = new Date(currentCalendarDate);
    drawCalendar(currentCalendarDate);
    drawDayContainer();
});

// Optimized Event Delegation (Avoids querying all items)
calGrid.addEventListener('click', e => {
    const target = e.target.closest('.calendar-day');
    if (target) {
        const oldSelected = calGrid.querySelector('.calendar-day.selected');
        if (oldSelected) oldSelected.classList.remove('selected');
        
        const dateParts = target.dataset.date.split('-');
        selectedDay = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        
        target.classList.add('selected');
        drawDayContainer();
    }
});

// Fetch Init
fetch('./calendar-events.json')
    .then(d => d.json())
    .then(eee => {
        events = eee;
        indexEvents(events); // Build lookups immediately
        drawCalendar(currentCalendarDate);
        drawDayContainer();
    });

// Weather API Optimization (Replaced heavy moment parsing with basic string slicing)
fetch('https://api.open-meteo.com/v1/forecast?latitude=45.5744&longitude=9.0754&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FBerlin')
    .then(d => d.json())
    .then(meteodata => {
        let html = '';
        const daily = meteodata.daily;
        for (let i = 0; i < daily.time.length; i++) {
            const dateStr = daily.time[i]; // "YYYY-MM-DD"
            const formattedDate = `${dateStr.substring(8, 10)}/${dateStr.substring(5, 7)}`;
            
            html += `<div class="weatherCode">
                ${formattedDate}
                ${getWeatherIcon(daily.weather_code[i])}
                <div class="temp flex-col">
                    <span>${daily.temperature_2m_max[i]}°c</span>
                    <span>${daily.temperature_2m_min[i]}°c</span>    
                </div>
            </div>`;
        }
        miscContainer.innerHTML = html;
    });



setTimeout(()=>document.location.reload(),60000)


document.getElementById('reload').addEventListener('click', () => document.location.reload());