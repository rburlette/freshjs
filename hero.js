import {freshElement} from './fresh.js';

const templateString = /*html*/`
<h2>{{this.heroInfo.name.toUpperCase()}} Details</h2>
<div><span>id: </span>{{this.heroInfo.Id}}</div>
<div>
  <label>name:
    <input [.value]="this.heroInfo.name" [.oninput]="e => this.onNameChange(e.target.value)" placeholder="name">
  </label>
  <span fjs-if="this.heroInfo.name == 'bob'">testing</span>
</div>
`;

class hero extends freshElement {
    constructor() {
        super(templateString);

        this.heroInfo = {
            name: 'Windstorm',
            Id: 1
        };
    }

    onNameChange(value) {
        this.heroInfo.name = value;
    }
}

customElements.define('fjs-hero', hero);