import {freshElement} from './fresh.js';
import * as timecard from './timecard-model.js';
import './ch-timecard-shift.js';

const templateString = /*html*/`
<style>
    :host {
        display: flex;
        flex-direction: column;
        flex: 1 1 0;
        min-width: 0;
        border-right: 1px solid lightgrey;
    }

    .name, .date {
        padding: 1px;
        border-bottom: 1px solid lightgrey;
        font-weight: bold;
        text-align: center;
    }

    .date {
        font-size: 12px;
    }

    .shifts {
        flex: 1; /* fills the column, so every day's add button lines up at the bottom */
        padding: 0 4px;
        border-bottom: 1px solid lightgrey;
    }

    .add {
        padding: 0 4px;
    }

    .add button {
        display: block;
        width: 100%;
        margin: 4px 0;
        font-size: 12px;
    }
</style>
<div class="name">{{this.day.name}}</div>
<div class="date">{{this.formatDate(this.day.date)}}</div>
<div class="shifts">
    <ch-timecard-shift fjs-for="shift in this.day.shifts" [.shift]="shift" [.number]="index + 1" [.times]="this.day.times"></ch-timecard-shift>
</div>
<div class="add">
    <button [.onclick]="() => this.addShift()">+ Add New Shift</button>
</div>
`;

// One day's column. The week passes in [.day].
class chTimeCardDay extends freshElement {
    constructor() {
        super(templateString);
    }

    formatDate(date) {
        return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
    }

    addShift() {
        timecard.addShift(this.day);
        this.refresh();
    }
}

customElements.define('ch-timecard-day', chTimeCardDay);
