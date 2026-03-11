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
    if (data.outliers && data.outliers.length) {
      html += '<div class="consensus-disagreements"><strong>Outliers:</strong><ul>';
      data.outliers.forEach(function(o) { html += '<li>' + admin.esc(o) + '</li>'; });
      html += '</ul></div>';
    }
    var conf = data.confidence;
    var confDisplay = typeof conf === 'number' ? conf + '/100' : this.esc(String(conf));
    var confColor = typeof conf === 'number' ? this.scoreColor(conf, 100) : 'var(--primary)';
    html += '<div class="consensus-confidence" style="color:' + confColor + '">Confidence: ' + confDisplay + '</div>';
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
      var html = '<div class="result-section">';
      html += '<p><strong>' + data.generated + '</strong> of ' + data.total + ' items got consensus.</p>';
      if (data.skipped > 0) {
        html += '<p style="color:var(--text-light); margin-top:0.5rem;">' + data.skipped +
          ' items skipped — need at least 2 written Definitions of Done per item to generate consensus.</p>';
      }
      if (data.errors.length > 0) {
        html += '<p style="color:#c00; margin-top:0.5rem;">' + data.errors.length + ' items failed to generate.</p>';
      }
      html += '</div>';
      detail.innerHTML = html;
      this.loadDashboard();
    } catch (err) {
      detail.innerHTML = '<p style="color:#c00">Failed.</p>';
    }
  },

  async clearAll() {
    if (!confirm('Delete ALL respondents, responses, and AI results? This cannot be undone.')) return;
    if (!confirm('Are you sure? This will wipe everything.')) return;
    try {
      const res = await fetch('/admin/clear-all', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const detail = document.getElementById('admin-detail');
        detail.textContent = 'All entries cleared.';
        this.loadDashboard();
      } else {
        alert('Failed to clear.');
      }
    } catch (err) {
      alert('Failed to clear.');
    }
  },

  switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelector('.admin-tab[onclick*="' + tab + '"]').classList.add('active');
    document.getElementById('tab-rankings').style.display = tab === 'rankings' ? 'block' : 'none';
    document.getElementById('tab-analysis').style.display = tab === 'analysis' ? 'block' : 'none';
    if (tab === 'analysis') this.loadAnalysis();
  },

  async loadAnalysis() {
    var container = document.getElementById('analysis-content');
    container.innerHTML = '<div class="results-loading"><div class="spinner"></div></div>';
    try {
      var res = await fetch('/admin/analysis');
      var data = await res.json();
      this.renderAnalysis(data);
    } catch (err) {
      container.innerHTML = '<p style="color:#c00">Failed to load analysis.</p>';
    }
  },

  renderAnalysis(data) {
    var container = document.getElementById('analysis-content');
    var html = '';

    // Category Rankings
    html += '<div class="analysis-section">';
    html += '<h3>Category Priority Rankings</h3>';
    if (data.categoryStats.length === 0) {
      html += '<p style="color:var(--text-light)">No data yet.</p>';
    } else {
      data.categoryStats.forEach(function(cat, idx) {
        var avg = cat.avg_importance || 0;
        var pct = (avg / 5) * 100;
        var color = admin.scoreColor(avg, 5);
        var categoryClass = admin.categoryClass(cat.category);
        html += '<div class="analysis-row">' +
          '<div class="analysis-row-left">' +
          '<span class="rank-number">' + (idx + 1) + '</span>' +
          '<span class="category-badge ' + categoryClass + '">' + admin.esc(cat.category) + '</span>' +
          '</div>' +
          '<div class="analysis-bar-wrap">' +
          '<div class="analysis-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
          '</div>' +
          '<span class="analysis-value" style="color:' + color + '">' + avg.toFixed(1) + '</span>' +
          '<span class="analysis-meta">' + cat.item_count + ' items, ' + cat.total_ratings + ' ratings</span>' +
          '</div>';
      });
    }
    html += '</div>';

    // Top 5
    html += '<div class="analysis-section">';
    html += '<h3>Top 5 Highest Priority</h3>';
    html += this.renderItemList(data.top5);
    html += '</div>';

    // Bottom 5
    html += '<div class="analysis-section">';
    html += '<h3>Bottom 5 Lowest Priority</h3>';
    html += this.renderItemList(data.bottom5);
    html += '</div>';

    // DoD Coverage
    html += '<div class="analysis-section">';
    html += '<h3>Definition of Done Coverage</h3>';
    var cov = data.dodCoverage;
    var covColor = this.scoreColor(cov.pct, 100);
    html += '<div class="coverage-stat">' +
      '<div class="coverage-ring" style="--pct:' + cov.pct + '%;--ring-color:' + covColor + '">' +
      '<span class="coverage-pct">' + cov.pct + '%</span>' +
      '</div>' +
      '<div class="coverage-detail">' +
      '<p><strong>' + cov.withDod + '</strong> of <strong>' + cov.total + '</strong> responses include a Definition of Done</p>' +
      '</div>' +
      '</div>';
    html += '</div>';

    // IDK Report
    if (data.idkStats.length > 0) {
      html += '<div class="analysis-section">';
      html += '<h3>Items With Most "I Don\'t Know" Responses</h3>';
      data.idkStats.forEach(function(item) {
        var pct = item.total_responses > 0 ? Math.round((item.idk_count / item.total_responses) * 100) : 0;
        var color = admin.scoreColor(100 - pct, 100);
        var categoryClass = admin.categoryClass(item.category);
        html += '<div class="analysis-row">' +
          '<div class="analysis-row-left">' +
          '<span class="category-badge ' + categoryClass + '" style="font-size:0.7rem">' + admin.esc(item.category) + '</span>' +
          '<span class="analysis-item-title">' + admin.esc(item.title) + '</span>' +
          '</div>' +
          '<div class="analysis-bar-wrap">' +
          '<div class="analysis-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
          '</div>' +
          '<span class="analysis-value" style="color:' + color + '">' + item.idk_count + '/' + item.total_responses + '</span>' +
          '</div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;
  },

  renderItemList(items) {
    if (!items || items.length === 0) return '<p style="color:var(--text-light)">No data yet.</p>';
    var html = '';
    items.forEach(function(item, idx) {
      var avg = item.avg_importance || 0;
      var pct = (avg / 5) * 100;
      var color = admin.scoreColor(avg, 5);
      var categoryClass = admin.categoryClass(item.category);
      html += '<div class="analysis-row">' +
        '<div class="analysis-row-left">' +
        '<span class="rank-number">' + (idx + 1) + '</span>' +
        '<span class="category-badge ' + categoryClass + '" style="font-size:0.7rem">' + admin.esc(item.category) + '</span>' +
        '<span class="analysis-item-title">' + admin.esc(item.title) + '</span>' +
        '</div>' +
        '<div class="analysis-bar-wrap">' +
        '<div class="analysis-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
        '</div>' +
        '<span class="analysis-value" style="color:' + color + '">' + avg.toFixed(1) + '</span>' +
        '</div>';
    });
    return html;
  },

  scoreColor(value, max) {
    var ratio = max > 0 ? value / max : 0;
    var r = Math.round(220 - ratio * 180);
    var g = Math.round(60 + ratio * 140);
    var b = 60;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => admin.loadDashboard());
