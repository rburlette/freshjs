// The timecard's data and rules as plain functions, with no HTML or DOM.
// The components in ch-timecard*.js show this data and call these functions when you click.
// Times are Date objects and durations are in hours.

export const services = [
    { name: 'Companion', value: 1 },
    { name: 'Homemaker', value: 2 },
    { name: 'Personal Care', value: 3 }
];

export const payers = [
    { name: 'Elena Rodriquez', value: 1 },
    { name: 'BCBS Insurance', value: 2 },
    { name: 'C & H', value: 3 }
];

const minute = 60000; // in milliseconds

// The demo's week: day name, day of May 2018, and each service as [service, start, end].
const sampleWeek = [
    ['Sunday',    1, [[1, '3:15', '4:45'], [2, '4:45', '6:00']]],
    ['Monday',    2, [[3, '3:15', '4:45'], [1, '4:45', '6:00'], [2, '6:00', '9:00']]],
    ['Tuesday',   3, [[3, '3:15', '4:45'], [2, '4:45', '6:00']]],
    ['Wednesday', 4, [[2, '4:45', '6:00']]],
    ['Thursday',  5, [[1, '3:15', '4:45'], [3, '4:45', '6:00']]],
    ['Friday',    6, [[2, '3:15', '4:45']]],
    ['Saturday',  7, [[3, '3:15', '4:45'], [2, '4:45', '6:45']]]
];

export function createSampleWeek() {
    return sampleWeek.map(([name, dayOfMonth, jobs]) => {
        let date = new Date(2018, 4, dayOfMonth);
        let atTime = text => new Date(2018, 4, dayOfMonth, ...text.split(':'));
        let day = {name, date, times: getTimes(date), shifts: []};

        let shift = {
            showDetails: false,
            maxTime: endOfDay(day),
            jobs: jobs.map(([service, start, end]) => ({service, payerId: 2, in: atTime(start), out: atTime(end)}))
        };

        updateShift(shift);

        // remember what was scheduled, so changes can be highlighted
        shift.needIn = new Date(shift.in);
        shift.needOut = new Date(shift.out);
        shift.needDuration = shift.duration;

        for(let job of shift.jobs) {
            job.duration = hours(job);
            job.needIn = new Date(job.in);
            job.needOut = new Date(job.out);
            job.needDuration = job.duration;
            job.isNew = false;
        }

        day.shifts.push(shift);
        return day;
    });
}

// Every quarter hour of the day for the In and Out dropdowns, then "End of Day" (midnight).
function getTimes(date) {
    let times = [];
    let time = new Date(date);

    while(time.getDate() === date.getDate()) {
        times.push({text: formatTime(time), value: time.toJSON(), date: new Date(time)});
        time.setMinutes(time.getMinutes() + 15);
    }

    times.push({text: 'End of Day', value: time.toJSON(), date: new Date(time)});
    return times;
}

function formatTime(date) {
    let hour = date.getHours();
    let minutes = String(date.getMinutes()).padStart(2, '0');
    return (hour % 12 || 12) + ':' + minutes + (hour < 12 ? ' AM' : ' PM');
}

function endOfDay(day) {
    return new Date(day.times[day.times.length - 1].date);
}

function hours(item) {
    return Math.abs(item.out - item.in) / 36e5;
}

// Recalculates a shift's start, end and total from its services.
function updateShift(shift) {
    shift.in = new Date(Math.min(...shift.jobs.map(job => job.in.getTime())));
    shift.out = new Date(Math.max(...shift.jobs.map(job => job.out.getTime())));
    shift.duration = hours(shift);
}

function moveJob(job, milliseconds) {
    job.in.setTime(job.in.getTime() + milliseconds);
    job.out.setTime(job.out.getTime() + milliseconds);
}

// Lengthens or shortens one service and moves the services after it.
// A service can't go below zero, so this returns the time it couldn't take.
function resizeService(shift, service, milliseconds) {
    let index = shift.jobs.findIndex(job => job.service === service);

    if(index === -1 || milliseconds === 0)
        return milliseconds;

    let job = shift.jobs[index];
    let change = Math.max(milliseconds, job.in - job.out);

    job.out.setTime(job.out.getTime() + change);
    job.duration = hours(job);

    for(let later of shift.jobs.slice(index + 1))
        moveJob(later, change);

    return milliseconds - change;
}

// Moves the whole shift so it starts at the chosen time.
export function changeShiftIn(shift, value) {
    let change = new Date(value) - shift.in;

    for(let job of shift.jobs)
        moveJob(job, change);

    updateShift(shift);

    if(shift.out > shift.maxTime)
        changeShiftOut(shift, shift.maxTime);
}

// Ends the shift at the chosen time, by taking the time from Companion first, then Homemaker, then Personal Care.
export function changeShiftOut(shift, value) {
    let change = new Date(value) - shift.out;

    for(let service of services)
        change = resizeService(shift, service.value, change);

    updateShift(shift);
}

export function addTime(shift, job, minutes) {
    resizeService(shift, job.service, minutes * minute);
    updateShift(shift);
}

// Services this job could switch to: its own, plus any the shift doesn't have yet.
export function getRemainingServices(shift, currentJob) {
    return services.filter(service => !shift.jobs.some(job => job !== currentJob && job.service === service.value));
}

// Adds an hour of a service the shift doesn't have yet, right after the last one.
export function addService(shift) {
    let lastJob = shift.jobs[shift.jobs.length - 1];
    let job = {
        service: getRemainingServices(shift)[0].value,
        payerId: lastJob.payerId,
        isNew: true,
        in: new Date(lastJob.out),
        out: new Date(lastJob.out.getTime() + 60 * minute)
    };

    job.duration = hours(job);
    shift.jobs.push(job);
    updateShift(shift);
}

// Adds a one-hour shift that starts an hour after the day's last shift ends.
export function addShift(day) {
    let lastShift = day.shifts[day.shifts.length - 1];
    let start = lastShift.out.getTime() + 60 * minute;
    let job = {service: 1, payerId: 2, isNew: true, in: new Date(start), out: new Date(start + 60 * minute)};
    let shift = {jobs: [job], isNew: true, maxTime: endOfDay(day)};

    job.duration = hours(job);
    updateShift(shift);
    day.shifts.push(shift);
}
