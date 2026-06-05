# Починка generated-вопросов — правки

Применяется: **21** · пропущено: **0**

| ID | Поля | До | После |
|---|---|---|---|
| `3U2wiNcWFBtTp3J7kZO9` | answerFormula | `"k*4"` | `"k*Math.sqrt(25-d*d)"` |
| `3U2wiNcWFBtTp3J7kZO9` | wrongFormulas | `["k*3","k*16","k*2"]` | `["k*5","k*d","Math.sqrt(25-d*d)"]` |
| `2hVhxUrjWRUu8x2KwP8v` | variables | `[{"name":"p","min":0.1,"max":0.9}]` | `[{"name":"p_num","min":1,"max":9}]` |
| `2hVhxUrjWRUu8x2KwP8v` | derivedVars | `[]` | `[{"name":"p","formula":"p_num/10"}]` |
| `2hVhxUrjWRUu8x2KwP8v` | answerFormula | `"1-p"` | `"1-p"` |
| `2hVhxUrjWRUu8x2KwP8v` | wrongFormulas | `["p","100-p","0"]` | `["p","100-p","p_num"]` |
| `AEb5BEbAv7SAnk5gpg61` | text | `"Реши уравнение"` | `"Реши уравнение: {a}*x + {c} = {b}"` |
| `AEb5BEbAv7SAnk5gpg61` | variables | `[{"name":"{a}*x+{c}","min":1,"max":10}]` | `[{"name":"a","min":2,"max":5},{"name":"x","min":1,"max":9},{"name":"c","min":1,"max":6}]` |
| `AEb5BEbAv7SAnk5gpg61` | derivedVars | `[{"name":"={b","formula":"={b}"}]` | `[{"name":"b","formula":"a*x+c"}]` |
| `AEb5BEbAv7SAnk5gpg61` | answerFormula | `"a:2:5,b:2:12,c:1:6"` | `"(b-c)/a"` |
| `AEb5BEbAv7SAnk5gpg61` | wrongFormulas | `["-","x=(b-c)/a или x=(-b-c)/a","x=(b+c)/a","x=(c-b)/a","корней нет"]` | `["(b+c)/a","(c-b)/a","-(b+c)/a"]` |
| `6HcqCsIcPZzi1YrYByGr` | wrongFormulas | `["a-b","b-a","abs(a)+abs(b)"]` | `["abs(a-b)+1","abs(a-b)+2","abs(a)+abs(b)+1"]` |
| `B6JoxKC0Ai4CSENsQbER` | answerFormula | `"pi/2 + 2*pi*k"` | `"pi/2 + 2*pi*n"` |
| `B6JoxKC0Ai4CSENsQbER` | wrongFormulas | `["pi/2 + pi*k","pi*k","2*pi*k"]` | `["pi/2 + pi*n","pi*n","2*pi*n"]` |
| `HH7HBK4Jpg3iStq1XxLt` | variables | `[{"name":"a","min":2,"max":null}]` | `[{"name":"k","min":1,"max":5}]` |
| `HH7HBK4Jpg3iStq1XxLt` | derivedVars | `[]` | `[{"name":"a","formula":"2*k"}]` |
| `LBnInIPRxn79uXwzaGf0` | variables | `[{"name":"a","min":10,"max":50},{"name":"b","min":10,"max":40},{"name":"s","min":30,"max":` | `[{"name":"a","min":10,"max":50},{"name":"b","min":10,"max":40}]` |
| `LBnInIPRxn79uXwzaGf0` | derivedVars | `[{"name":"s","formula":"a+b"}]` | `[]` |
| `LBnInIPRxn79uXwzaGf0` | answerFormula | `"sin(s)"` | `"sin((a+b)*pi/180)"` |
| `LBnInIPRxn79uXwzaGf0` | wrongFormulas | `["cos(s)","sin(a-b)","1"]` | `["cos((a+b)*pi/180)","sin((a-b)*pi/180)","1"]` |
| `LBrtxGlbwafgYUbTqNta` | answerFormula | `"a"` | `"((-1)**n)*a"` |
| `LXklQJ01lFI4l8H2nJOW` | answerFormula | `"m9.8"` | `"m*9.8"` |
| `Nzi4eGxJC6DbYbNIs9X1` | wrongFormulas | `["x1+x2","k","x1*x2"]` | `["x1+x2","x2","x1*x2"]` |
| `OFUPs3aOcFrg0Ii3yi0P` | text | `"На круговой диаграмме сектор, составляющий половину круга, имеет угол {a} градусов."` | `"На круговой диаграмме сектор, составляющий половину круга, имеет угол сколько градусов?"` |
| `PUTXjcOpwPEuikoXteM6` | variables | `[{"name":"a","min":0.2,"max":0.8}]` | `[{"name":"a_num","min":2,"max":8}]` |
| `PUTXjcOpwPEuikoXteM6` | derivedVars | `[]` | `[{"name":"a","formula":"a_num/10"}]` |
| `RqfZIUJzBfVOKOsR1xF2` | derivedVars | `[{"name":"D","formula":"(M+m)a"}]` | `[{"name":"D","formula":"(M+m)*a"}]` |
| `S8q6TgqLcR1YPzx2uA6U` | text | `"Найди все делители числа {n}"` | `"Сколько делителей у числа {n}?"` |
| `S8q6TgqLcR1YPzx2uA6U` | answerFormula | `"ДЕЛИТЕЛЬ(n)"` | `"[...Array(n+1).keys()].filter(d=>d>0&&n%d===0).length"` |
| `S8q6TgqLcR1YPzx2uA6U` | wrongFormulas | `["1, 2 и {n}","ПРОСТЫЕДЕЛИТЕЛИ(n)","все числа меньше {n}"]` | `["[...Array(n+1).keys()].filter(d=>d>1&&n%d===0).length","[...Array(n).keys()].filter(d=>d` |
| `VvdFEiTovjEqvfwz0ejm` | text | `"Реши уравнение"` | `"Реши уравнение \|x\| = {a}. В ответ запиши наибольший корень."` |
| `VvdFEiTovjEqvfwz0ejm` | variables | `[{"name":"x","min":1,"max":10}]` | `[{"name":"a","min":2,"max":12}]` |
| `VvdFEiTovjEqvfwz0ejm` | derivedVars | `[{"name":"={a","formula":"={a}"}]` | `[]` |
| `VvdFEiTovjEqvfwz0ejm` | answerFormula | `"a:1:12"` | `"a"` |
| `VvdFEiTovjEqvfwz0ejm` | wrongFormulas | `["-","x=a или x=-a","x=a","x=-a","корней нет"]` | `["-a","2*a","a-1","0"]` |
| `VvdFEiTovjEqvfwz0ejm` | answerDisplay | `null` | `""` |
| `WZPwlIySQYDyiQuxd4MA` | answerFormula | `"(2m1m2)/(m1+m2)"` | `"(2*m1*m2)/(m1+m2)"` |
| `WZPwlIySQYDyiQuxd4MA` | wrongFormulas | `["(m1m2)/(m1+m2)","(m1-m2)/(m1+m2)","2(m1-m2)"]` | `["(m1*m2)/(m1+m2)","(m1-m2)/(m1+m2)","2*(m1-m2)"]` |
| `iFLMZspcT6JEoP5EszpG` | answerFormula | `"cos(d)"` | `"cos(d*pi/180)"` |
| `iFLMZspcT6JEoP5EszpG` | wrongFormulas | `["sin(d)","cos(a+b)","1"]` | `["sin(d*pi/180)","cos((a+b)*pi/180)","1"]` |
| `iIqxAe7WabgU8kCU1aXI` | answerFormula | `"k"` | `"gcd(k*x,k*y)"` |
| `lEZOQCSmxKcaQ4iTVOr6` | answerFormula | `"k"` | `"gcd(a,b)"` |
| `pGX64XbjDxFVObt2t3Ft` | wrongFormulas | `["n/(p/q)","p*q*n","n-p/q"]` | `["n*p","n*p+q","n*p-q"]` |
| `xeOCUPSzJP5qdsXJVw57` | answerFormula | `"плюс"` | `"минус"` |
| `xeOCUPSzJP5qdsXJVw57` | wrongFormulas | `["минус","ноль","невозможно определить"]` | `["плюс","ноль","невозможно определить"]` |

## Пропущено

| ID | Причина |
|---|---|