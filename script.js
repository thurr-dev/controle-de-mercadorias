const KEY_ESTOQUE = 'adega_master_estoque';
const KEY_VENDAS = 'adega_master_vendas';

function migrarDados() {
    let estoqueMigrado = JSON.parse(localStorage.getItem(KEY_ESTOQUE)) || [];
    let vendasMigradas = JSON.parse(localStorage.getItem(KEY_VENDAS)) || [];
    const versoes = ['adega_v7','adega_v8','adega_v9','adega_v10','adega_v11','adega_v12','adega_v13','adega_v14'];
    versoes.forEach(v => {
        let estAntigo = JSON.parse(localStorage.getItem(v + '_est'));
        let venAntigo = JSON.parse(localStorage.getItem(v + '_ven'));
        if(estAntigo) {
            estAntigo.forEach(p => { if(!estoqueMigrado.find(x => x.ean === p.ean)) estoqueMigrado.push(p); });
            localStorage.removeItem(v + '_est');
        }
        if(venAntigo) {
            vendasMigradas = [...vendasMigradas, ...venAntigo];
            localStorage.removeItem(v + '_ven');
        }
    });
    localStorage.setItem(KEY_ESTOQUE, JSON.stringify(estoqueMigrado));
    localStorage.setItem(KEY_VENDAS, JSON.stringify(vendasMigradas));
    return { estoqueMigrado, vendasMigradas };
}

const dadosIniciais = migrarDados();
let estoque = dadosIniciais.estoqueMigrado;
let vendas = dadosIniciais.vendasMigradas;
let carrinho = [];
let html5QrCode;
const NUMERO_ZAP = "5511988207302";

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
    const dataH = new Date().toLocaleDateString('pt-pt', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let totalV = 0;
    carrinho.forEach(c => {
        const e = estoque.find(i => i.ean === c.ean);
        if(e) {
            e.qtd -= c.qtdVenda;
            totalV += (c.preco * c.qtdVenda);
            if(e.qtd <= 5) alertas.push(`🚨 *${e.nome}* A ACABAR! Restam ${e.qtd}.`);
        }
    });
    vendas.push({ data: dataH, valor: totalV, timestamp: new Date().toISOString() });
    carrinho = [];
    salvar();
    alert("Venda realizada!");
    if(alertas.length > 0) window.open(`https://wa.me/${NUMERO_ZAP}?text=${window.encodeURIComponent(alertas.join("\n"))}`);
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("RELATORIO DE VENDAS - ADEGA", 20, 20);
    let y = 35;
    vendas.forEach(v => {
        if(y > 280) { doc.addPage(); y = 20; }
        doc.text(`${v.data}: R$ ${v.valor.toFixed(2)}`, 20, y);
        y += 10;
    });
    doc.save("vendas_adega.pdf");
}

function gerarExcel() {
    const ws = XLSX.utils.json_to_sheet(vendas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    XLSX.writeFile(wb, "vendas_adega.xlsx");
}

function editarProduto(ean) {
    const p = estoque.find(i => i.ean === ean);
    if(p) {
        p.nome = prompt("Nome:", p.nome) || p.nome;
        p.qtd = parseInt(prompt("Quantidade:", p.qtd));
        p.preco = parseFloat(prompt("Preço:", p.preco));
        p.venc = prompt("Vencimento (DD/MM/AAAA):", p.venc);
        salvar();
    }
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
                    <button class="btn-acao btn-edit" onclick="editarProduto('${i.ean}')">✏️</button>
                    <button class="btn-acao btn-del" onclick="if(confirm('Eliminar?')){estoque=estoque.filter(x=>x.ean!=='${i.ean}');salvar();}">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    div.innerHTML = html + '</table>';
}

renderEstoque();