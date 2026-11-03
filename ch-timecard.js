import {freshElement} from './fresh.js';

const templateString = /*html*/`
<style>
    :host, table {
        width: 100%;
    }

    header {
        background: #3d3d3d;
        font-size: 12px;
        color: #fff;
        font-weight: bold;
        text-align: center;
    }

    input[type="text"] {
        width: 80px;
    }

    .needs, .shifts {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }

    .shifts > li {
        margin: 4px 0;
        border: 1px solid #3d3d3d;
        padding: 0;
        border-top-left-radius: 3px;
        border-top-right-radius: 3px;
    }

    .shifts > li.is-new {
        border: 1px solid #ff9900;
    }

    label {
        display: block;
        font-size: 12px;
    }

    table {
        border-collapse: collapse;
    }

    th, td {
        border: 1px solid lightgrey;
        width: 14.28%;
    }

    td {
        vertical-align: top;
        padding: 0 4px;
    }

    tr:last-child {
        text-align: center;
        vertical-align: middle;
    }

    .flex-lr {
        display: flex;
        justify-content: space-between;
    }

    .flex-lr label {
        padding: 0 3px;
    }

    .flex-lr select {
        margin: 1px 2px;
    }

    .needs li[data-service="1"] {
        background-color: #dbedf5;
    }

    .needs li[data-service="2"] {
        background-color: #baf8d4;
    }

    .needs li[data-service="3"] {
        background-color: #d1d1ff;
    }

    .needs li[data-new] {
        border: 1px solid yellow;
    }

    select {
        background: #ffffff;
        border: 1px solid lightgrey;
        font-size: 12px;
    }

    .changed {
        background: rgba(255, 255, 0, 0.59);
    }

    .total .changed {
        color: yellow;
        background: inherit;
    }

    .date-header {
        font-size: 12px;
    }

    .service {
        background-color: inherit;
        color: inherit;
        border: none;
        width: 100%;
        border-bottom: 1px solid;
        font-weight: bold;
        font-size: 12px;
    }

    .service:disabled {
        -webkit-appearance: none;
    }

    .total {
        color: rgb(255, 255, 255);
        background: #575757;
        font-size: 11px;
        font-weight: bold;
    }

    .close {
        margin: 0 0 0 4px;
        font-size: 9px;
        padding: 1px 4px 0px 4px;
        display: none;
    }

    .is-new .close {
        display: block;
    }

    .add-new {
        font-size: 12px;
        display: block;
        width: 100%;
        margin: 4px 0;
    }

    .toolbar {
        display: flex;
    }

    .toolbar button {
        font-size: 12px;
        flex: 0 1 50%;
        padding: 1px;
    }

    .adj-container button {
        font-size: 11px;
        margin: 1px 0;
        padding: 0px 5px;
    }

    .adj-container {
        margin: 0 2px;
        display: inline-flex;
    }
</style>
<table>
    <tr>
        <th fjs-for="day in this.days">{{day.day}}</th>
    </tr>
    <tr>
        <th fjs-for="day in this.days" class="date-header">{{this.formatDate(day.date)}}</th>
    </tr>
    <tr>
        <td fjs-for="day in this.days">
            <ul class="shifts">
                <li fjs-for="shift in day.shifts">
                    <header>Shift {{index + 1}}</header>
                    <div class="flex-lr">
                        <label>In:</label>
                        <select [.value]="shift.in.toJSON()" [.onchange]="e => this.changeShiftIn(shift, e.target.value)" [class]="this.inClass(shift)">
                            <option fjs-for="time in day.times" [.value]="time.value">{{time.text}}</option>
                        </select>
                    </div>

                    <div class="flex-lr">
                        <label>Out:</label>
                        <select [.value]="shift.out.toJSON()" [.onchange]="e => this.changeShiftOut(shift, e.target.value)" [class]="this.outClass(shift)">
                            <option fjs-for="time in day.times" [.value]="time.value" [.disabled]="this.isDisabled(time, shift)">{{time.text}} </option>
                        </select>
                    </div>
                    <div class="total flex-lr">
                        <label>Shift Total:</label>
                        <label [class]="this.durationClass(shift)">{{shift.duration}}hrs</label>
                    </div>
                    <ol class="needs">
                        <li fjs-for="job in shift.jobs" [data-service]="job.service" [data-new]="job.isNew">
                            <div fjs-if="this.showDetails(shift, job)">
                                <div class="flex-lr">
                                    <label>Service: </label>
                                    <select [.value]="job.service" [.disabled]="!job.isNew" [.onchange]="e => this.serviceOnChange(job, e.target.value)">
                                        <option fjs-for="service in this.getRemainingServices(shift, job)" [.value]="service.value">{{service.name}}</option>
                                    </select>
                                </div>

                                <div class="flex-lr">
                                        <label>Payer:</label>
                                        <select [.value]="job.payerId" [.onchange]="e => this.payerOnChange(job, e.target.value)" [.disabled]="!job.isNew">
                                            <option fjs-for="payer in this.payers" [.value]="payer.value">{{payer.name}}</option>
                                        </select>
                                </div>
                                <div class="flex-lr">
                                    <label>Duration:</label>
                                    <div class="adj-container">
                                        <label [class]="this.durationClass(job)">{{job.duration}}hrs</label>
                                        <button [.disabled]="shift.out.getTime() == shift.maxTime.getTime()" [.onclick]="() => this.addTime(job, shift, 900000)">+</button>
                                        <button [.disabled]="job.duration == 0" [.onclick]="() => this.addTime(job, shift, -900000)">-</button>
                                    </div>
                                </div>
                            </div>
                            <div fjs-if="!this.showDetails(shift, job)">
                                <div class="flex-lr">
                                    <label>{{this.services[job.service - 1].name}}:</label>
                                    <div class="adj-container">
                                        <label [class]="this.durationClass(job)">{{job.duration}}hrs</label>
                                        <button [.disabled]="shift.out.getTime() == shift.maxTime.getTime()" [.onclick]="() => this.addTime(job, shift, 900000)">+</button>
                                        <button [.disabled]="job.duration == 0" [.onclick]="() => this.addTime(job, shift, -900000)">-</button>
                                    </div>
                                </div>
                            </div>
                        </li>
                    </ol>

                    <div class="toolbar">
                        <button [.onclick]="() => this.toggleDetails(shift)">{{shift.showDetails ? 'Hide' : 'Show'}} Details</button>
                        <button [.disabled]="shift.jobs.length >= 3" [.onclick]="() => this.addService(shift)">Add Service</button>
                    </div>
                </li>
            </ul>
        </td>
    </tr>
    <tr>
        <td fjs-for="day in this.days">
            <button class="add-new" [.onclick]="() => this.addShift(day)">+ Add New Shift</button>
        </td>
    </tr>
</table>
`;


class chTimeCard extends freshElement {
    constructor() {
        super(templateString);
        this.initialize();
    }

    initialize() {
        this.services = [
            { name: 'Companion', value: 1 },
            { name: 'Homemaker', value: 2 },
            { name: 'Personal Care', value: 3 }
        ];

        this.payers = [
            { name: 'Elena Rodriquez', value: 1 },
            { name: 'BCBS Insurance', value: 2 },
            { name: 'C & H', value: 3 }
        ];

        this.days =  [
            {
                day: 'Sunday',
                date: new Date(2018, 4, 1),
                times: this.getTimes(new Date(2018, 4, 1)),
                shifts: [{
                    jobs:[
                        {
                            service: 1,
                            payerId: 2,
                            in: new Date(2018, 4, 1, 3, 15),
                            out: new Date(2018, 4, 1, 4, 45)
                        },
                        {
                            service: 2,
                            payerId: 2,
                            in: new Date(2018, 4, 1, 4, 45),
                            out: new Date(2018, 4, 1, 6)
                        }
                    ]
                }]
            },
            {
                day: 'Monday',
                date: new Date(2018, 4, 2),
                times: this.getTimes(new Date(2018, 4, 2)),
                shifts: [{
                    jobs:[
                        {
                            service: 3,
                            payerId: 2,
                            in: new Date(2018, 4, 2, 3, 15),
                            out: new Date(2018, 4, 2, 4, 45)
                        },
                        {
                            service: 1,
                            payerId: 2,
                            in: new Date(2018, 4, 2, 4, 45),
                            out: new Date(2018, 4, 2, 6)
                        },
                        {
                            service: 2,
                            payerId: 2,
                            in: new Date(2018, 4, 2, 6),
                            out: new Date(2018, 4, 2, 9)
                        }
                    ]
                }]
            },
            {
                day: 'Tuesday',
                date: new Date(2018, 4, 3),
                times: this.getTimes(new Date(2018, 4, 3)),

                shifts: [{
                    jobs:[
                        {
                            service: 3,
                            payerId: 2,
                            in: new Date(2018, 4, 3, 3, 15),
                            out: new Date(2018, 4, 3, 4, 45)
                        },
                        {
                            service: 2,
                            payerId: 2,
                            in: new Date(2018, 4, 3, 4, 45),
                            out: new Date(2018, 4, 3, 6)
                        }
                    ]
                }]
            },
            {
                day: 'Wednesday',
                date: new Date(2018, 4, 4),
                times: this.getTimes(new Date(2018, 4, 4)),
                shifts: [{
                    jobs:[
                        {
                            service: 2,
                            payerId: 2,
                            in: new Date(2018, 4, 4, 4, 45),
                            out: new Date(2018, 4, 4, 6)
                        }
                    ]
                }]

            },
            {
                day: 'Thursday',
                date: new Date(2018, 4, 5),
                times: this.getTimes(new Date(2018, 4, 5)),
                shifts: [{
                    jobs:[
                        {
                            service: 1,
                            payerId: 2,
                            in: new Date(2018, 4, 5, 3, 15),
                            out: new Date(2018, 4, 5, 4, 45)
                        },
                        {
                            service: 3,
                            payerId: 2,
                            in: new Date(2018, 4, 5, 4, 45),
                            out: new Date(2018, 4, 5, 6)
                        }
                    ]
                }]

            },
            {
                day: 'Friday',
                date: new Date(2018, 4, 6),
                times: this.getTimes(new Date(2018, 4, 6)),
                shifts: [{
                    jobs:[
                        {
                            service: 2,
                            payerId: 2,
                            in: new Date(2018, 4, 6, 3, 15),
                            out: new Date(2018, 4, 6, 4, 45)
                        }
                    ]
                }]

            },
            {
                day: 'Saturday',
                date: new Date(2018, 4, 7),
                times: this.getTimes(new Date(2018, 4, 7)),
                shifts: [{
                    jobs:[
                        {
                            service: 3,
                            payerId: 2,
                            in: new Date(2018, 4, 7, 3, 15),
                            out: new Date(2018, 4, 7, 4, 45)
                        },
                        {
                            service: 2,
                            payerId: 2,
                            in: new Date(2018, 4, 7, 4, 45),
                            out: new Date(2018, 4, 7, 6, 45)
                        }
                    ]
                }]
            }

        ];

        let day, shift, job;
        for(let i = 0; i < this.days.length; i++) {
            day = this.days[i];
            for(let k = 0; k < day.shifts.length; k++) {
                shift = day.shifts[k];
                shift.showDetails = false;

                shift.in = this.calcShiftIn(shift);
                shift.out = this.calcShiftOut(shift);
                shift.duration = this.calcDuration(shift);

                shift.needIn = new Date(shift.in);
                shift.needOut = new Date(shift.out);
                shift.needDuration = shift.duration;

                shift.maxTime = new Date(day.times[day.times.length - 1].value);

                for(let j = 0; j < shift.jobs.length; j++) {
                    job = shift.jobs[j];
                    job.needIn = new Date(job.in);
                    job.needOut = new Date(job.out);
                    job.duration = this.calcDuration(job);
                    job.needDuration = job.duration;
                    job.isNew = false;
                }
            }
        }
    }

    showDetails(shift, job) {
        return (shift.showDetails || job.isNew);
    }

    payerOnChange(job, value) {
        job.payerId = Number(value);
    }

    serviceOnChange(job, value) {
        job.service = Number(value);
        this.refresh();
    }

    addTime(job, shift, timeDiff) {
        this.changeService(shift, job.service, timeDiff);
        shift.out = this.calcShiftOut(shift);
        shift.duration = this.calcDuration(shift);
        this.refresh();
    }

    toggleDetails(shift) {
        shift.showDetails = !shift.showDetails;
        this.refresh();
    }

    isDisabled(time, shift) {
        return time.date.getTime() < shift.in.getTime();
    }

    formatDate(date) {
        return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
    }

    getTimes(currentDate) {
        let myDay = new Date(currentDate);

        let dateNum = myDay.getDate();

        let times = [];

        while(myDay.getDate() === dateNum) {
            var hr = myDay.getHours();

            var min = myDay.getMinutes();

            if (min < 10) {
                min = '0' + min;
            }
            var ampm = 'AM';
            if( hr > 12 ) {
                hr -= 12;
                ampm = 'PM';
            }

            times.push({
                text: hr + ':' + min + ' ' + ampm,
                value: myDay.toJSON(),
                date: new Date(myDay)
            });

            myDay.setMinutes(myDay.getMinutes() + 15);
        }

        times.push({
            text: 'End of Day',
            value: myDay.toJSON(),
            date: new Date(myDay)
        });

        return times;
    }

    calcShiftIn(shift) {
        let min;
        for(let i = 0; i < shift.jobs.length; i++) {
            if(!min || shift.jobs[i].in.getTime() < min)
                min = shift.jobs[i].in.getTime();
        }
        return new Date(min);
    }

    calcShiftOut(shift) {
        let max;
        for(let i = 0; i < shift.jobs.length; i++) {
            if(!max || shift.jobs[i].out.getTime() > max)
                max = shift.jobs[i].out.getTime();
        }
        return new Date(max);
    }

    getRemainingServices(shift, currentJob) {
        let hasService = [false, false, false];

        for(let i = 0; i < shift.jobs.length; i++) {
            hasService[shift.jobs[i].service - 1] = true;
        }

        if(currentJob) {
            hasService[currentJob.service - 1] = false;
        }

        let availableServices = [];

        for(let i = 0; i < this.services.length; i++) {
            if(hasService[i] == false) {
                availableServices.push(this.services[i]);
            }
        }

        return availableServices;
    }

    addService(shift) {
        let lastJob = shift.jobs[shift.jobs.length - 1];

        let newJob = {
            payerId: lastJob.payerId,
            isNew: true,
            in: new Date(lastJob.out),
            out: new Date(lastJob.out.getTime() + (900000 * 4))
        };

        newJob.duration = this.calcDuration(newJob);

        newJob.service = this.getRemainingServices(shift)[0].value;

        shift.jobs.push(newJob);

        shift.out = this.calcShiftOut(shift);
        shift.duration = this.calcDuration(shift);

        this.refresh();
    }

    changeShiftIn(shift, value) {
        let timeDiff = new Date(value) - shift.in;

        shift.jobs.forEach(function(job) {
            job.in.setTime(job.in.getTime() + timeDiff);
            job.out.setTime(job.out.getTime() + timeDiff);
            job.duration = this.calcDuration(job);
        }, this);

        shift.in = this.calcShiftIn(shift);
        shift.out = this.calcShiftOut(shift);

        if(shift.out.getTime() > shift.maxTime.getTime())
            this.changeEndShift(shift, shift.maxTime);

        shift.duration = this.calcDuration(shift);

        this.refresh();
    }

    changeShiftOut(shift, value) {
        this.changeEndShift(shift, new Date(value));
        this.refresh();
    }

    inClass(shift){
        if(shift.isNew || (shift.needIn && shift.in.getTime() !== shift.needIn.getTime()))
            return 'changed';
    }

    outClass(shift) {
        if(shift.isNew || (shift.needOut && shift.out.getTime() !== shift.needOut.getTime()))
            return 'changed';
    }

    durationClass(item) {
        if(item.isNew || (item.needDuration && item.needDuration != item.duration))
            return 'changed';
    }

    jobClass(item) {
        let myClass =  ['companion', 'personal', 'home'][item.service - 1];
        if(item.isNew)
            myClass += ' is-new';

        return myClass;
    }

    calcDuration(item) {
        return Math.abs(item.out - item.in) / 36e5;
    }

    changeEndShift(shift, newTime) {

        let timeDiff = newTime - shift.out;

        timeDiff = this.changeService(shift, 1, timeDiff);
        timeDiff = this.changeService(shift, 2, timeDiff);
        this.changeService(shift, 3, timeDiff);


        shift.out = this.calcShiftOut(shift);
        shift.duration = this.calcDuration(shift);
    }

    changeService(shift, service, timeDiff) {
        if(timeDiff === 0)
            return 0;

        let serviceIndex = this.services.length;
        let actualTimeDiff = timeDiff;
        shift.jobs.forEach(function(job, index) {

            if(job.service == service) {
                if(timeDiff < 0)
                    actualTimeDiff = Math.max(timeDiff, job.in.getTime() - job.out.getTime());

                serviceIndex = index;

                job.out.setTime(job.out.getTime() + actualTimeDiff);
                job.duration = this.calcDuration(job);
            }

            if(index > serviceIndex) {
                job.in.setTime(job.in.getTime() + actualTimeDiff);
                job.out.setTime(job.out.getTime() + actualTimeDiff);
                job.duration = this.calcDuration(job);
            }
        }, this);

        if(serviceIndex < this.services.length)
            return timeDiff - actualTimeDiff;
        else
            return timeDiff;
    }

    addShift(day) {
        let prevShift = day.shifts[day.shifts.length - 1];
        let prevJob = prevShift.jobs[prevShift.jobs.length - 1];

        let newShift = {
            jobs:[
                {
                    service: 1,
                    payerId: 2,
                    in: new Date(prevJob.out.getTime() + (900000 * 4)),
                    out: new Date(prevJob.out.getTime() + (900000 * 8)),
                    isNew: true
                }
            ],
            isNew: true,
            maxTime: new Date(day.times[day.times.length - 1].value)
        };

        newShift.jobs[0].duration = this.calcDuration(newShift.jobs[0]);

        newShift.in = this.calcShiftIn(newShift);
        newShift.out = this.calcShiftOut(newShift);

        newShift.duration = this.calcDuration(newShift);

        day.shifts.push(newShift);
        this.refresh();
    }
}

customElements.define('ch-timecard', chTimeCard);