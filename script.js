const KEY_ESTOQUE = 'adega_master_estoque';
const KEY_VENDAS = 'adega_master_vendas';
const NUMERO_ZAP = "5511988207302";

let estoque = JSON.parse(localStorage.getItem(KEY_ESTOQUE)) || [];
let vendas = JSON.parse(localStorage.getItem(KEY_VENDAS)) || [];
let carrinho = [];
let html5QrCode;
let meuGrafico = null;

// Máscaras e Utilitários
function mascaraData(i) {
    let v = i.value.replace(/\D/g, '');
    if (v.length > 2) v = v.substring(0,2) + '/' + v.substring(2);
    if (v.length > 5) v = v.substring(0,5) + '/' + v.substring(5,9);
    i.value = v;
}

function bip() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = 1000; gain.gain.value = 0.1;
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

// Funções de Venda e Scanner
function iniciarLeitor() {
    document.getElementById('reader').style.display = 'block';
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 15, qrbox: 250 }, (codigo) => {
        bip();
        html5QrCode.stop().then(() => {
            document.getElementById('reader').style.display = 'none';
            processarLeitura(codigo);
        });
    });
}

function processarLeitura(codigo) {
    const produto = estoque.find(i => i.ean === codigo);
    if (produto) {
        const qtd = prompt(`Produto: ${produto.nome}\nQuantas unidades?`, "1");
        if (qtd && parseInt(qtd) > 0) {
            const noCarrinho = carrinho.find(c => c.ean === codigo);
            if (noCarrinho) noCarrinho.qtdVenda += parseInt(qtd); else carrinho.push({...produto, qtdVenda: parseInt(qtd)});
            renderCarrinho();
        }
    } else {
        document.getElementById('cad-ean').value = codigo;
        alert("Novo produto! Complete o cadastro.");
    }
}

function renderCarrinho() {
    const div = document.getElementById('carrinhoLista');
    div.innerHTML = ''; let total = 0;
    carrinho.forEach((item, idx) => {
        total += (item.preco * item.qtdVenda);
        div.innerHTML += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #333;">
            <span>${item.nome} (x${item.qtdVenda})</span>
            <span>R$ ${(item.preco * item.qtdVenda).toFixed(2)} <button onclick="carrinho.splice(${idx},1);renderCarrinho();" style="color:red;background:none;border:none;">X</button></span>
        </div>`;
    });
    document.getElementById('valorTotal').innerText = `R$ ${total.toFixed(2)}`;
    document.getElementById('btnFinalizar').style.display = carrinho.length > 0 ? 'block' : 'none';
}

function finalizarVenda() {
    let alertas = [];
    const dataH = new Date().toLocaleDateString('pt-br', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let totalV = 0;
    carrinho.forEach(c => {
        const e = estoque.find(i => i.ean === c.ean);
        if(e) {
            e.qtd -= c.qtdVenda;
            totalV += (c.preco * c.qtdVenda);
            if(e.qtd <= 5) alertas.push(`🚨 *${e.nome}* ACABANDO! Restam ${e.qtd}.`);
        }
    });
    vendas.push({ data: dataH, valor: totalV, timestamp: new Date().toISOString() });
    carrinho = [];
    salvar();
    alert("Venda realizada!");
    if(alertas.length > 0) window.open(`https://wa.me/${NUMERO_ZAP}?text=${window.encodeURIComponent(alertas.join("\n"))}`);
}

// Funções de Estoque e Devolução
function registrarDevolucao(ean) {
    const p = estoque.find(i => i.ean === ean);
    if (!p) return;
    const qtdDev = prompt(`Devolução de ${p.nome}\nQuantas unidades retornam ao estoque?`, "1");
    if (qtdDev && parseInt(qtdDev) > 0) {
        const qtd = parseInt(qtdDev);
        p.qtd += qtd;
        const dataH = new Date().toLocaleDateString('pt-br', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        vendas.push({ data: dataH + " (DEVOLUÇÃO)", valor: -(p.preco * qtd), timestamp: new Date().toISOString() });
        salvar();
        alert("Stock atualizado e venda estornada!");
    }
}

function abrirCalendario(nome, dataVenc) {
    if(!dataVenc || dataVenc.length < 10) { alert("Data inválida!"); return; }
    const partes = dataVenc.split('/');
    const dataFormatada = partes[2] + partes[1] + partes[0];
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("VENCIMENTO: "+nome)}&dates=${dataFormatada}/${dataFormatada}`;
    window.open(url, '_blank');
}

function salvarProduto() {
    const p = {
        ean: document.getElementById('cad-ean').value,
        nome: document.getElementById('cad-nome').value,
        qtd: parseInt(document.getElementById('cad-qtd').value) || 0,
        preco: parseFloat(document.getElementById('cad-preco').value) || 0,
        venc: document.getElementById('cad-venc').value
    };
    if(!p.ean || !p.nome) return alert("Preencha Nome e Código!");
    estoque.push(p);
    salvar();
    document.querySelectorAll('input').forEach(i => i.value = '');
}

function salvar() {
    localStorage.setItem(KEY_ESTOQUE, JSON.stringify(estoque));
    localStorage.setItem(KEY_VENDAS, JSON.stringify(vendas));
    renderEstoque();
    renderCarrinho();
}

function renderEstoque() {
    const div = document.getElementById('listaEstoque');
    let html = '<table><tr><th>Item</th><th>Qtd</th><th>Ações</th></tr>';
    estoque.forEach(i => {
        html += `<tr>
            <td><strong>${i.nome}</strong><br><small>Val: ${i.venc || '---'}</small></td>
            <td class="${i.qtd <= 5 ? 'alerta-estoque' : ''}">${i.qtd}</td>
            <td>
                <div style="display:flex; gap:3px;">
                    <button class="btn-acao" style="background:#f39c12;" onclick="editarProduto('${i.ean}')">✏️</button>
                    <button class="btn-acao" style="background:#e67e22;" onclick="abrirCalendario('${i.nome}', '${i.venc}')">📅</button>
                    <button class="btn-acao" style="background:#9b59b6;" onclick="registrarDevolucao('${i.ean}')">🔄</button>
                    <button class="btn-acao btn-del" onclick="if(confirm('Eliminar?')){estoque=estoque.filter(x=>x.ean!=='${i.ean}');salvar();}">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    div.innerHTML = html + '</table>';
}

// LÓGICA DO GRÁFICO (4 SEMANAS COMPARATIVAS)
function toggleRelatorio() {
    const cont = document.getElementById('conteudoRelatorio');
    const seta = document.getElementById('seta-relatorio');
    if (cont.style.display === 'none') {
        cont.style.display = 'block'; seta.innerText = '▲'; renderizarGraficoSemanas();
    } else {
        cont.style.display = 'none'; seta.innerText = '▼';
    }
}

function processarDadosGrafico() {
    // 4 semanas, 7 dias cada (0=Dom, 1=Seg...)
    const semanas = [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
    vendas.forEach(v => {
        const d = new Date(v.timestamp);
        const diaMes = d.getDate();
        const diaSemana = d.getDay();
        let sIdx = 0;
        if(diaMes > 7 && diaMes <= 14) sIdx = 1;
        else if(diaMes > 14 && diaMes <= 21) sIdx = 2;
        else if(diaMes > 21) sIdx = 3;
        semanas[sIdx][diaSemana] += v.valor;
    });
    return semanas;
}

function renderizarGraficoSemanas() {
    const dadosSemanas = processarDadosGrafico();
    const ctx = document.getElementById('graficoVendas').getContext('2d');
    if(meuGrafico) meuGrafico.destroy();
    
    meuGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
            datasets: [
                { label: 'Sem 1', data: dadosSemanas[0], borderColor: '#3498db', tension: 0.2 },
                { label: 'Sem 2', data: dadosSemanas[1], borderColor: '#2ecc71', tension: 0.2 },
                { label: 'Sem 3', data: dadosSemanas[2], borderColor: '#f1c40f', tension: 0.2 },
                { label: 'Sem 4', data: dadosSemanas[3], borderColor: '#e74c3c', tension: 0.2 }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#fff' } } },
            scales: {
                y: { grid: { color: '#333' }, ticks: { color: '#fff' } },
                x: { ticks: { color: '#fff' } }
            }
        }
    });
}

function gerarRelatorioSemanal() {
    const dados = processarDadosGrafico();
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const rel = [];
    dados.forEach((s, idx) => {
        s.forEach((v, dIdx) => {
            rel.push({ "Semana": `Semana ${idx+1}`, "Dia": dias[dIdx], "Total R$": v.toFixed(2) });
        });
    });
    const ws = XLSX.utils.json_to_sheet(rel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, "vendas_diarias_semanal.xlsx");
}

// Funções de Exportação Simples
function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("VENDAS ADEGA", 20, 20);
    vendas.slice(-15).forEach((v, i) => doc.text(`${v.data}: R$ ${v.valor.toFixed(2)}`, 20, 30+(i*10)));
    doc.save("vendas.pdf");
}

function gerarExcel() {
    const ws = XLSX.utils.json_to_sheet(vendas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    XLSX.writeFile(wb, "vendas_completo.xlsx");
}

function editarProduto(ean) {
    const p = estoque.find(i => i.ean === ean);
    if(p) {
        p.nome = prompt("Nome:", p.nome) || p.nome;
        p.qtd = parseInt(prompt("Quantidade:", p.qtd)) || 0;
        p.preco = parseFloat(prompt("Preço:", p.preco)) || 0;
        p.venc = prompt("Vencimento (DD/MM/AAAA):", p.venc) || "";
        salvar();
    }
}

renderEstoque();
