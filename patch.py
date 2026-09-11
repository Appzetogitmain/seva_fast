
import re
path = 'c:/Users/admin/Desktop/appzeto/sevafast/frontend/src/modules/seller/pages/Orders.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(
    r'name: item\.name,([\s]+)price: item\.price,([\s]+)qty: item\.quantity,',
    r'name: item.variantSlot ? \g<0> : item.name,\1price: item.price,\2qty: item.quantity,'.replace('\g<0>', ' ()'),
    c
)

c = re.sub(
    r'const itemsHtml = order\.items\.map\(item => \{([\s]+)const name = item\.name;([\s]+)const qtyStr = x\$\{item\.qty\};',
    r'const itemsHtml = order.items.map(item => {\1const name = item.variantSlot ? \ (\) : item.name;\2const qtyStr = x\;',
    c
)

c = re.sub(
    r'const itemsHtml = order\.items\.map\(\(item, index\) => \{([\s]+)const price = item\.price;([\s]+)const total = item\.price \* item\.qty;([\s]+)return ([\s]+)<tr>([\s]+)<td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">\$\{index \+ 1\}</td>([\s]+)<td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">([\s]+)<div style="font-weight: bold; color: #1e293b;">\$\{item\.name\}</div>',
    r'const itemsHtml = order.items.map((item, index) => {\1const price = item.price;\2const qty = item.qty || item.quantity;\2const total = price * qty;\2const name = item.variantSlot ? \ (\) : item.name;\3return \4<tr>\5<td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">\</td>\6<td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">\7<div style="font-weight: bold; color: #1e293b;">\</div>',
    c
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
