let sidebar;
let calendar;
let courses = JSON.parse(localStorage.getItem('savedCourses')) || [];;

// Initialize the sidebar when aurora.umanitoba.ca/*
window.addEventListener('load', () => {
  loadSidebar(courses);

  if (document.body.innerText.includes('Sections Found')) {
    const newCourses = getCourseData();
    console.log(newCourses);
    localStorage.setItem('savedCourses', JSON.stringify(courses));
    initializeCoursesDisplayment(newCourses);
  }
})

// Load the sidebar HTML dynamically
function loadSidebar(courses) {
  fetch(chrome.runtime.getURL('src/sidebar.html'))
    .then((response) => response.text())
    .then((html) => {
      document.body.insertAdjacentHTML('beforeend', html);
      initializeSidebarLogic();
      initializeFullCalendar();
      // initializeCoursesDisplayment(courses); // Load any pre-existing courses
    })
    .catch((error) => console.error('Error loading sidebar:', error));
}

// Initialize any additional JavaScript logic
function initializeSidebarLogic() {
  const toggleButton = document.getElementById('toggleSidebar');

  // Check if the toggleButton exists before adding an event listener
  if (toggleButton) {
    toggleButton.addEventListener('click', function () {
      const sidebar = document.getElementById('coursePlannerSidebar');
      const pluginTitle = document.getElementById('pluginTitle');
      if (sidebar.style.height === '40px') {
        pluginTitle.style.opacity = '100'
        sidebar.style.height = '700px';
        sidebar.style.width = '40%';
      } else {
        pluginTitle.style.opacity = '0'
        sidebar.style.height = '40px';
        sidebar.style.width = '40px';
      }
    });
  }
}

// Initialize FullCalendar
function initializeFullCalendar() {
  const calendarEl = document.getElementById('calendar');

  if (!calendarEl) {
    return console.error('Calendar element not found');
  }

  // FullCalendar should already be available globally
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',       // Show the week view
    hiddenDays: [0, 6],                // Hide Saturday (6) and Sunday (0)
    headerToolbar: false,
    slotMinTime: '08:00:00',           // Start time 8:00 AM
    slotMaxTime: '22:00:00',           // End time 10:00 PM
    height: 'auto',                    // Adjust the height automatically
    allDaySlot: false,                 // Disable the all-day slot
    dayHeaderFormat: {                 // Format the day headers to only show the day of the week
      weekday: 'long'                  // Display 'Mon', 'Tue', etc.
    },
    nowIndicator: false,               // Hide the marker indicating the current time
  });

  calendar.render();

  // Re-add existing courses/events from localStorage
  courses.forEach(course => {
    const { parsedDay, start24Hour, end24Hour } = parseDayAndTime(course.Days, course.Time);
    calendar.addEvent({
      id: course.CRN,
      title: `${course.Name} ${course.Sec}`,
      daysOfWeek: parsedDay,
      startTime: `${start24Hour}`,
      endTime: `${end24Hour}`,
    });
  })

  console.log('FullCalendar rendered successfully');
}

// Initialize Course List
function initializeCoursesDisplayment (courses) {
  const courseList = document.getElementById('courseList');
  
  if (!courseList) {
    return console.error('Course List element not found');
  }

  courseList.innerHTML = '';

  if (courses.length === 0) {
    courseList.innerHTML = '<p>No sections available</p>'
    return;
  }

  // Make unorder list
  courseList.innerHTML += `
    <p style="font-weight: bold; margin: 0; font-size: 20px; margin-bottom: 5px;">${courses[0].Name}</p>
    <p style="font-weight: bold; margin: 0; margin-bottom: 5px;">List of Sections</p>
    <ul>
      ${courses.map(course => `
        <li style="display: flex; justify-content: space-between; align-items: center;">
          <span><strong>CRN:</strong> ${course.CRN}</span>
          <button id="${course.CRN}" class="add-btn">+</button>
        </li>
      `).join('')}
    </ul>
  `;

  // Initialize buttons after rendering the list
  courses.forEach(course => initializeAddRemoveBtn(course.CRN));
}

function initializeAddRemoveBtn (crn) {
  const button = document.getElementById(crn);
  const course = courses.find(course => course.CRN === crn);

  if (button) {
    button.addEventListener('click', function () {
      const {parsedDay, start24Hour, end24Hour} = parseDayAndTime(course.Days, course.Time);

      // check if the course is already added to the calendar
      if (!calendar.getEventById(crn)) {
        calendar.addEvent({
          id: course.CRN,
          title: `${course.Name} ${course.Sec}`,
          daysOfWeek: parsedDay,
          startTime: `${start24Hour}`,
          endTime: `${end24Hour}`,
        });
        courses.push(course); // Add to the courses list
        localStorage.setItem('savedCourses', JSON.stringify(courses)); // Save to localStorage
        console.log(`Added ${course.CRN} to the calendar.`);
        // change button style
        button.style.backgroundColor = '#c54e4e';
        button.innerText = '×';
      } else {
        calendar.getEventById(crn).remove();
        courses = courses.filter(c => c.CRN !== course.CRN); // Remove from the courses list
        localStorage.setItem('savedCourses', JSON.stringify(courses)); // Update localStorage
        console.log(`Removed ${course.CRN} from the calendar.`);
        // change button style
        button.style.backgroundColor = '#3f629c';
        button.innerText = '+';
      } 
    });
  }
}

// Helper to get course data from the table element
function getCourseData() {
  const courses = [];
  // .datadisplaytable = table that we need (there are multiple ones); tr = table row
  const tableRows = document.querySelectorAll('.datadisplaytable tr');

  tableRows.forEach((row) => {
    const cells = row.querySelectorAll('td'); // td = cell

    // DE = distance course; &nbsp; = blank space when there is no data & time
    if (cells.length > 2 && !cells[8]?.innerHTML.includes('&nbsp;')) {
      const crn = cells[1]?.querySelector('a')?.innerText.trim(); // Access text inside the <a> tag
      const subj = cells[2]?.innerText.trim();
      const crse = cells[3]?.innerText.trim();
      const sect = cells[4]?.innerText.trim();
      const days = cells[8]?.innerText.trim();
      const time = cells[9]?.innerText.trim();
      const date = cells[17]?.innerText.trim();

      if (crn) {
        courses.push({
          CRN: crn,
          Name: `${subj}${crse}`,
          Sec: `${sect}`, 
          Days: days,
          Time: time,
          Date: date,
        });
      }
    }
  });
  return courses;
}

// parse data
function parseDayAndTime(days, time) {
  // parse day
  const dayMapping = {
    M: '1', // Monday
    T: '2', // Tuesday
    W: '3', // Wednesday
    R: '4', // Thursday
    F: '5', // Friday
  };
  const parsedDay = days.split('').map((day) => dayMapping[day]);

  // parse time
  const [startTime, endTime] = time.split('-');
  // helper for parsing time
  function convertTo24Hour(timeStr) {
    const [time, period] = timeStr.split(' ');
    let [hour, min] = time.split(':');
    if (hour === '12') {
      hour = '00';
    }
    if (period === 'pm') {
      // parse hour into int (base 10)
      hour = parseInt(hour, 10) + 12;
    }
    // hour must has 2 digit, adding 0 in the front if there is only 1 digit
    return `${hour.toString().padStart(2, '0')}:${min}`;
  }
  const start24Hour = convertTo24Hour(startTime);
  const end24Hour = convertTo24Hour(endTime);

  return { parsedDay, start24Hour, end24Hour };
}