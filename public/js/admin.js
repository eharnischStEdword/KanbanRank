const admin = {
  async loadDashboard() {
    try {
      const res = await fetch('/admin/results');
      const data = await res.json();
      this.renderRankedList(data.items, data.totalRespondents);
    } catch (err) {
      document.getElementById('ranked-list').innerHTML = '<p style="color:#c00">Failed to load.</p>';
    }
  },

  renderRankedList(items, totalRespondents) {
    document.getElementById('respondent-count').textContent =
      totalRespondents + ' response' + (totalRespondents !== 1 ? 's' : '') + ' submitted';

    const list = document.getElementById('ranked-list');
    if (items.length === 0 || totalRespondents === 0) {
      list.innerHTML = '<p style="color:var(--text-light)">No responses yet.</p>';
      return;
    }

    list.innerHTML = items.map((item, idx) => {
      const avg = item.avg_importance ? item.avg_importance.toFixed(1) : '\u2014';
      const categoryClass = this.categoryClass(item.category);
      return '<div class="rank-row" data-item-id="' + item.id + '">' +
        '<div class="rank-row-main" onclick="admin.toggleItem(' + item.id + ')">' +
        '<span class="rank-number">' + (idx + 1) + '</span>' +
        '<div class="rank-info">' +
        '<span class="rank-title">' + this.esc(item.title) + '</span>' +
        '<span class="category-badge ' + categoryClass + '">' + this.esc(item.category) + '</span>' +
        '</div>' +
        '<div class="rank-score">' +
        '<span class="score-badge">' + avg + '</span>' +
        '<span class="response-count">' + item.response_count + ' rated</span>' +
        '</div>' +
        '</div>' +
        '<div class="rank-detail" id="detail-' + item.id + '" style="display:none;"></div>' +
        '</div>';
    }).join('');
  },

  categoryClass(cat) {
    if (cat.includes('Facilities')) return 'cat-facilities';
    if (cat.includes('Faith')) return 'cat-faith';
    if (cat.includes('User')) return 'cat-ux';
    if (cat.includes('Culture')) return 'cat-culture';
    return '';
  },

  async toggleItem(itemId) {
    const detail = document.getElementById('detail-' + itemId);
    if (detail.style.display === 'none') {
      detail.style.display = 'block';
      await this.loadItemDetail(itemId);
    } else {
      detail.style.display = 'none';
    }
  },

  async loadItemDetail(itemId) {
    const detail = document.getElementById('detail-' + itemId);
    detail.innerHTML = '<div class="results-loading"><div class="spinner"></div></div>';

    try {
      const [responsesRes, consensusRes] = await Promise.all([
        fetch('/admin/items/' + itemId + '/responses'),
        fetch('/admin/items/' + itemId + '/consensus')
      ]);
      const responses = await responsesRes.json();
      const consensus = await consensusRes.json();

      let html = '';

      html += '<div class="consensus-section">';
      if (consensus) {
        html += this.renderConsensus(consensus);
      }
      html += '<button class="btn btn-secondary admin-btn" onclick="admin.generateConsensus(' + itemId + ')">' +
        (consensus ? 'Regenerate' : 'Generate') + ' Consensus</button>';
      html += '</div>';

      html += '<div class="responses-section"><h4>Individual Responses</h4>';
      if (responses.length === 0) {
        html += '<p style="color:var(--text-light)">No responses yet.</p>';
      } else {
        responses.forEach(r => {
          const name = r.name || 'Anonymous';
          html += '<div class="response-card">' +
            '<div class="response-header"><span class="response-name">' + this.esc(name) + '</span>' +
            '<span class="response-importance">Importance: ' + r.importance + '/5</span></div>';
          if (r.definition_of_done) {
            html += '<p class="response-dod">' + this.esc(r.definition_of_done) + '</p>';
          } else {
            html += '<p class="response-dod" style="color:var(--text-light); font-style:italic;">No definition provided</p>';
          }
          html += '</div>';
        });
      }
      html += '</div>';

      detail.innerHTML = html;
    } catch (err) {
      detail.innerHTML = '<p style="color:#c00">Failed to load details.</p>';
    }
  },

  renderConsensus(data) {
    let html = '<div class="consensus-box">';
    html += '<h4>Consensus Definition of Done</h4>';
    html += '<p class="consensus-definition">' + this.esc(data.consensusDefinition) + '</p>';
    if (data.commonThemes && data.commonThemes.length) {
      html += '<div class="consensus-themes"><strong>Common Themes:</strong> ' +
        data.commonThemes.map(t => this.esc(t)).join(', ') + '</div>';
    }
    if (data.disagreements && data.disagreements.length) {
      html += '<div class="consensus-disagreements"><strong>Disagreements:</strong><ul>';
      data.disagreements.forEach(d => { html += '<li>' + this.esc(d) + '</li>'; });
      html += '</ul></div>';
    }
    html += '<div class="consensus-confidence">Confidence: ' + this.esc(data.confidence) + '</div>';
    html += '</div>';
    return html;
  },

  async generateConsensus(itemId) {
    const detail = document.getElementById('detail-' + itemId);
    const consensusSection = detail.querySelector('.consensus-section');
    if (consensusSection) {
      consensusSection.innerHTML = '<div class="results-loading"><div class="spinner"></div><p>Generating consensus...</p></div>';
    }

    try {
      const res = await fetch('/admin/items/' + itemId + '/consensus', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        if (consensusSection) consensusSection.innerHTML = '<p style="color:#c00">' + this.esc(data.error) + '</p>';
        return;
      }
      await this.loadItemDetail(itemId);
    } catch (err) {
      if (consensusSection) consensusSection.innerHTML = '<p style="color:#c00">Failed to generate.</p>';
    }
  },

  async generateAll() {
    const detail = document.getElementById('admin-detail');
    detail.innerHTML = '<div class="results-loading"><div class="spinner"></div><p>Generating consensus for all items... This may take a minute.</p></div>';

    try {
      const res = await fetch('/admin/consensus/all', { method: 'POST' });
      const data = await res.json();
      detail.innerHTML = '<div class="result-section"><p>Generated consensus for ' + data.generated + ' items.' +
        (data.errors.length ? ' ' + data.errors.length + ' errors.' : '') + '</p></div>';
      this.loadDashboard();
    } catch (err) {
      detail.innerHTML = '<p style="color:#c00">Failed.</p>';
    }
  },

  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => admin.loadDashboard());
