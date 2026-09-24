import {freshElement} from '../fresh.js';
export const rowTemplate = `<tr fjs-for="row in this.rows" fjs-key="row.id" [class]="row.id === this.selected ? 'danger' : ''">
<td class="col-md-1">{{row.id}}</td>
<td class="col-md-4"><a [.onclick]="() => this.select(row.id)">{{row.label}}</a></td>
<td class="col-md-1"><a [.onclick]="() => this.remove(row.id)"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a></td>
<td class="col-md-6"></td>
</tr>`;
export class FreshTable extends freshElement {
  constructor(template = `<table class="table table-hover table-striped test-data"><tbody>${rowTemplate}</tbody></table>`) {
    super(template);
    this.rows = [];
    this.selected = null;
  }
  select(id) { this.selected = id; this.refresh(); }
  remove(id) { this.rows = this.rows.filter(row => row.id !== id); this.refresh(); }
}
customElements.define('fresh-benchmark', FreshTable);
