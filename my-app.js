import {freshElement} from './fresh.js';
import './ch-timecard.js';
import './ttt-game.js';
import './hero.js';
//import './todo-mvc/todo-app.js';

const templateString = /*html*/`
<ch-timecard></ch-timecard>
<ttt-game></ttt-game>
<ttt-game></ttt-game>
<fjs-hero></fjs-hero>
`;

class myApp extends freshElement {
    constructor() {
        super(templateString);
    }
}

customElements.define('my-app', myApp);