/* Receptury českých jídel. Suroviny se uvádějí SYROVÉ, v gramech, na uvedený počet porcí.
   w = hmotnost hotového pokrmu v gramech (po odpaření vody, po odkapání tuku).
   Z toho build skript spočítá kcal a makra na 100 g hotového jídla.
   U smažených jídel se uvádí jen tuk skutečně vstřebaný, ne celý olej z pánve. */
module.exports = [

/* ───────────── POLÉVKY ───────────── */
{ n:'Kuřecí vývar s nudlemi', k:'polévky', w:1500, sur:[
  ['Kuřecí stehno bez kůže',150],['Mrkev',100],['Petržel kořen',60],['Celer bulva',60],
  ['Cibule',50],['Těstoviny semolinové syrové',60],['Sůl',13],['Voda pitná',1800]] },

{ n:'Hovězí vývar s masem a nudlemi', k:'polévky', w:1500, sur:[
  ['Hovězí přední',250],['Mrkev',100],['Petržel kořen',60],['Celer bulva',60],['Cibule',50],
  ['Těstoviny semolinové syrové',50],['Sůl',13],['Voda pitná',1800]] },

{ n:'Bramborová polévka', k:'polévky', w:1600, sur:[
  ['Brambory',500],['Mrkev',80],['Petržel kořen',50],['Celer bulva',50],['Cibule',80],
  ['Houby čerstvé',80],['Mouka pšeničná hladká',30],['Máslo',30],['Majoránka sušená',2],
  ['Česnek',10],['Sůl',14],['Voda pitná',1600]] },

{ n:'Zelňačka s klobásou', k:'polévky', w:1600, sur:[
  ['Kysané zelí bílé',400],['Brambory',300],['Klobása',250],['Maso uzené (plec)',200],['Cibule',80],['Sádlo vepřové',20],
  ['Mouka pšeničná hladká',25],['Zakysaná smetana 15%',100],['Paprika sladká mletá',5],
  ['Sůl',8],['Voda pitná',1400]] },

{ n:'Gulášová polévka', k:'polévky', w:1600, sur:[
  ['Hovězí přední',350],['Brambory',300],['Cibule',200],['Paprika červená',100],
  ['Rajčatový protlak',40],['Sádlo vepřové',30],['Mouka pšeničná hladká',20],
  ['Paprika sladká mletá',12],['Kmín celý',3],['Česnek',10],['Sůl',14],['Voda pitná',1400]] },

{ n:'Čočková polévka', k:'polévky', w:1500, sur:[
  ['Čočka syrová',200],['Mrkev',80],['Cibule',80],['Česnek',10],['Sádlo vepřové',20],
  ['Mouka pšeničná hladká',20],['Ocet kvasný 8%',15],['Majoránka sušená',2],['Sůl',13],
  ['Voda pitná',1500]] },

{ n:'Hrachová polévka s uzeným', k:'polévky', w:1500, sur:[
  ['Hrách žlutý syrový',200],['Maso uzené (plec)',150],['Mrkev',80],['Cibule',80],
  ['Česnek',10],['Sádlo vepřové',15],['Majoránka sušená',2],['Sůl',8],['Voda pitná',1500]] },

{ n:'Kulajda', k:'polévky', w:1500, sur:[
  ['Brambory',350],['Houby čerstvé',150],['Zakysaná smetana 15%',250],['Vejce slepičí',200],
  ['Mouka pšeničná hladká',30],['Ocet kvasný 8%',20],['Cukr krystal',10],['Sůl',13],
  ['Voda pitná',1200]] },

{ n:'Dršťková polévka', k:'polévky', w:1500, sur:[
  ['Dršťky hovězí vařené',550],['Cibule',150],['Sádlo vepřové',30],['Mouka pšeničná hladká',30],
  ['Paprika sladká mletá',12],['Majoránka sušená',3],['Česnek',12],['Sůl',13],['Voda pitná',1400]] },

{ n:'Kmínová polévka s vejcem', k:'polévky', w:1400, sur:[
  ['Vývar zeleninový',1400],['Mouka pšeničná hladká',40],['Máslo',30],['Vejce slepičí',100],
  ['Kmín celý',6]] },

{ n:'Květáková polévka', k:'polévky', w:1500, sur:[
  ['Květák',450],['Mrkev',80],['Brambory',150],['Máslo',30],['Mouka pšeničná hladká',25],
  ['Mléko plnotučné 3,5%',200],['Sůl',12],['Voda pitná',1200]] },

{ n:'Houbová polévka kyselá', k:'polévky', w:1500, sur:[
  ['Houby čerstvé',250],['Brambory',250],['Cibule',80],['Máslo',25],['Mouka pšeničná hladká',25],
  ['Zakysaná smetana 15%',150],['Ocet kvasný 8%',15],['Kmín celý',3],['Sůl',13],['Voda pitná',1300]] },

{ n:'Fazolová polévka', k:'polévky', w:1500, sur:[
  ['Fazole bílé syrové',180],['Mrkev',80],['Cibule',80],['Slanina',60],
  ['Mouka pšeničná hladká',20],['Rajčatový protlak',30],['Česnek',10],['Sůl',12],['Voda pitná',1500]] },

{ n:'Zeleninová polévka', k:'polévky', w:1500, sur:[
  ['Mrkev',150],['Petržel kořen',80],['Celer bulva',80],['Brambory',200],['Hrášek zelený',100],
  ['Květák',150],['Máslo',20],['Sůl',12],['Voda pitná',1400]] },

{ n:'Česnečka s chlebem a sýrem', k:'polévky', w:1400, sur:[
  ['Vývar hovězí',1400],['Česnek',40],['Brambory',200],['Eidam 30%',80],
  ['Chléb pšenično-žitný',100],['Máslo',20],['Kmín celý',3]] },

/* ───────────── OMÁČKY A MASO ───────────── */
{ n:'Svíčková na smetaně (omáčka)', k:'omáčky a maso', w:1500, sur:[
  ['Mrkev',250],['Petržel kořen',120],['Celer bulva',120],['Cibule',150],['Slanina',50],
  ['Máslo',40],['Smetana 31%',200],['Mouka pšeničná hladká',40],['Cukr krystal',25],
  ['Ocet kvasný 8%',25],['Hořčice plnotučná',20],['Bobkový list',2],['Nové koření',2],
  ['Sůl',10],['Voda pitná',900]] },

{ n:'Svíčková na smetaně s masem', k:'omáčky a maso', w:2000, sur:[
  ['Hovězí zadní',700],['Mrkev',250],['Petržel kořen',120],['Celer bulva',120],['Cibule',150],
  ['Slanina',80],['Máslo',60],['Smetana 31%',250],['Mouka pšeničná hladká',40],['Cukr krystal',25],
  ['Ocet kvasný 8%',25],['Hořčice plnotučná',20],['Sůl',12],['Voda pitná',900]] },

{ n:'Rajská omáčka s hovězím', k:'omáčky a maso', w:1900, sur:[
  ['Hovězí přední',700],['Rajčatový protlak',250],['Cibule',150],['Mrkev',100],['Sádlo vepřové',40],
  ['Mouka pšeničná hladká',40],['Cukr krystal',50],['Ocet kvasný 8%',15],['Nové koření',2],
  ['Sůl',12],['Voda pitná',900]] },

{ n:'Koprová omáčka s vejcem', k:'omáčky a maso', w:1400, sur:[
  ['Mléko plnotučné 3,5%',600],['Zakysaná smetana 15%',200],['Mouka pšeničná hladká',50],
  ['Máslo',40],['Vejce slepičí',300],['Ocet kvasný 8%',15],['Cukr krystal',15],['Sůl',9],
  ['Voda pitná',400]] },

{ n:'Křenová omáčka s uzeným', k:'omáčky a maso', w:1700, sur:[
  ['Maso uzené (plec)',600],['Mléko plnotučné 3,5%',500],['Smetana na vaření 12%',200],
  ['Křen čerstvý',80],['Mouka pšeničná hladká',45],['Máslo',40],['Cukr krystal',15],['Sůl',4],
  ['Voda pitná',400]] },

{ n:'Hovězí guláš', k:'omáčky a maso', w:1400, sur:[
  ['Hovězí přední',700],['Vepřový bok',150],['Cibule',400],['Sádlo vepřové',50],['Paprika sladká mletá',15],
  ['Rajčatový protlak',40],['Mouka pšeničná hladká',30],['Česnek',15],['Kmín celý',4],
  ['Majoránka sušená',3],['Sůl',18],['Voda pitná',700]] },

{ n:'Vepřový guláš', k:'omáčky a maso', w:1500, sur:[
  ['Vepřová plec',800],['Cibule',350],['Sádlo vepřové',40],['Paprika sladká mletá',15],
  ['Rajčatový protlak',40],['Mouka pšeničná hladká',25],['Česnek',15],['Kmín celý',4],
  ['Sůl',12],['Voda pitná',700]] },

{ n:'Segedínský guláš', k:'omáčky a maso', w:1800, sur:[
  ['Vepřová plec',700],['Kysané zelí bílé',600],['Cibule',250],['Sádlo vepřové',40],
  ['Zakysaná smetana 15%',200],['Mouka pšeničná hladká',30],['Paprika sladká mletá',12],
  ['Kmín celý',3],['Sůl',8],['Voda pitná',500]] },

{ n:'Vepřová pečeně', k:'omáčky a maso', w:750, odkap:30, sur:[
  ['Vepřová krkovice',1000],['Sádlo vepřové',20],['Česnek',15],['Kmín celý',5],['Sůl',12]] },

{ n:'Vepřové výpečky', k:'omáčky a maso', w:700, odkap:80, sur:[
  ['Vepřový bok',1000],['Cibule',150],['Česnek',15],['Kmín celý',5],['Sůl',12]] },

{ n:'Pečené kuře', k:'omáčky a maso', w:1050, odkap:60, sur:[
  ['Kuře celé s kůží',1400],['Máslo',40],['Česnek',10],['Sůl',12],['Kmín celý',4]] },

{ n:'Kuře na paprice', k:'omáčky a maso', w:1600, sur:[
  ['Kuřecí stehno bez kůže',800],['Cibule',200],['Máslo',40],['Zakysaná smetana 15%',300],
  ['Smetana na vaření 12%',150],['Mouka pšeničná hladká',35],['Paprika sladká mletá',15],
  ['Sůl',10],['Voda pitná',500]] },

{ n:'Znojemská pečeně', k:'omáčky a maso', w:1500, sur:[
  ['Vepřová kýta',800],['Okurka sterilovaná',250],['Cibule',150],['Sádlo vepřové',30],
  ['Mouka pšeničná hladká',30],['Hořčice plnotučná',20],['Sůl',8],['Voda pitná',600]] },

{ n:'Moravský vrabec', k:'omáčky a maso', w:750, odkap:80, sur:[
  ['Vepřový bok',1000],['Cibule',150],['Česnek',20],['Kmín celý',6],['Sádlo vepřové',20],['Sůl',12]] },

{ n:'Španělský ptáček', k:'omáčky a maso', w:1600, sur:[
  ['Hovězí zadní',700],['Vejce slepičí',200],['Párky',150],['Okurka sterilovaná',150],
  ['Slanina',80],['Cibule',150],['Hořčice plnotučná',30],['Sádlo vepřové',30],
  ['Mouka pšeničná hladká',30],['Sůl',10],['Voda pitná',700]] },

{ n:'Roštěná na cibulce', k:'omáčky a maso', w:1100, sur:[
  ['Hovězí zadní',800],['Cibule',350],['Sádlo vepřové',40],['Mouka pšeničná hladká',25],
  ['Sůl',10],['Voda pitná',400]] },

{ n:'Sekaná pečeně', k:'omáčky a maso', w:1000, sur:[
  ['Hovězí mleté 15% tuku',500],['Vepřová plec',400],['Houska',150],['Vejce slepičí',100],
  ['Cibule',120],['Česnek',15],['Mléko plnotučné 3,5%',120],['Strouhanka',40],
  ['Majoránka sušená',3],['Sůl',14]] },

{ n:'Karbanátky', k:'omáčky a maso', w:850, sur:[
  ['Hovězí mleté 15% tuku',600],['Houska',120],['Vejce slepičí',100],['Cibule',100],
  ['Česnek',12],['Strouhanka',60],['Olej řepkový',50],['Majoránka sušená',3],['Sůl',12]] },

{ n:'Játra na cibulce', k:'omáčky a maso', w:750, sur:[
  ['Játra vepřová',800],['Cibule',300],['Sádlo vepřové',40],['Mouka pšeničná hladká',20],
  ['Sůl',9],['Majoránka sušená',2]] },

{ n:'Vepřové koleno pečené', k:'omáčky a maso', w:1100, odkap:60, sur:[
  ['Vepřové koleno',1600],['Pivo světlé 10°',200],['Česnek',25],['Kmín celý',8],['Sůl',15]] },

{ n:'Kuřecí přírodní plátek', k:'omáčky a maso', w:650, sur:[
  ['Kuřecí prsa bez kůže',800],['Olej řepkový',25],['Sůl',8]] },

/* ───────────── SMAŽENÁ JÍDLA ───────────── */
{ n:'Smažený vepřový řízek', k:'smažená', w:900, sur:[
  ['Vepřová kýta',800],['Mouka pšeničná hladká',60],['Vejce slepičí',150],['Strouhanka',120],
  ['Olej řepkový',130],['Sůl',9]] },

{ n:'Smažený kuřecí řízek', k:'smažená', w:880, sur:[
  ['Kuřecí prsa bez kůže',800],['Mouka pšeničná hladká',60],['Vejce slepičí',150],
  ['Strouhanka',120],['Olej řepkový',120],['Sůl',9]] },

{ n:'Smažený sýr', k:'smažená', w:620, sur:[
  ['Eidam 30%',500],['Mouka pšeničná hladká',40],['Vejce slepičí',100],['Strouhanka',90],
  ['Olej řepkový',90]] },

{ n:'Smažený hermelín', k:'smažená', w:580, sur:[
  ['Hermelín',480],['Mouka pšeničná hladká',35],['Vejce slepičí',100],['Strouhanka',80],
  ['Olej řepkový',80]] },

{ n:'Smažený květák', k:'smažená', w:750, sur:[
  ['Květák',800],['Mouka pšeničná hladká',60],['Vejce slepičí',150],['Strouhanka',100],
  ['Olej řepkový',110],['Sůl',8]] },

{ n:'Smažený kapr', k:'smažená', w:850, sur:[
  ['Kapr',900],['Mouka pšeničná hladká',50],['Vejce slepičí',100],['Strouhanka',90],
  ['Olej řepkový',100],['Sůl',9]] },

{ n:'Smažené žampiony', k:'smažená', w:700, sur:[
  ['Žampiony',700],['Mouka pšeničná hladká',50],['Vejce slepičí',100],['Strouhanka',90],
  ['Olej řepkový',100],['Sůl',7]] },

/* ───────────── BEZMASÁ A HOTOVKY ───────────── */
{ n:'Špenát se smetanou', k:'bezmasá', w:900, sur:[
  ['Špenát mražený',800],['Smetana na vaření 12%',150],['Mouka pšeničná hladká',20],
  ['Máslo',30],['Česnek',20],['Sůl',7]] },

{ n:'Dušené bílé zelí', k:'bezmasá', w:850, sur:[
  ['Zelí bílé',1000],['Cibule',100],['Sádlo vepřové',30],['Cukr krystal',20],
  ['Ocet kvasný 8%',20],['Kmín celý',4],['Sůl',8],['Voda pitná',150]] },

{ n:'Dušené červené zelí', k:'bezmasá', w:850, sur:[
  ['Zelí červené',1000],['Cibule',100],['Sádlo vepřové',30],['Cukr krystal',30],
  ['Ocet kvasný 8%',25],['Kmín celý',3],['Sůl',8],['Voda pitná',150]] },

{ n:'Fazole na kyselo', k:'bezmasá', w:1200, sur:[
  ['Fazole bílé syrové',300],['Cibule',100],['Mouka pšeničná hladká',30],['Máslo',30],
  ['Ocet kvasný 8%',25],['Cukr krystal',15],['Česnek',10],['Sůl',9],['Voda pitná',1000]] },

{ n:'Houbový kuba', k:'bezmasá', w:1100, sur:[
  ['Kroupy syrové',300],['Houby čerstvé',250],['Cibule',120],['Sádlo vepřové',40],
  ['Česnek',20],['Majoránka sušená',3],['Sůl',9],['Voda pitná',900]] },

{ n:'Kroupové karbanátky', k:'bezmasá', w:800, sur:[
  ['Kroupy syrové',250],['Vejce slepičí',100],['Cibule',100],['Strouhanka',60],
  ['Olej řepkový',60],['Česnek',12],['Majoránka sušená',3],['Sůl',8],['Voda pitná',600]] },

{ n:'Bramborové knedlíky plněné uzeným', k:'bezmasá', w:1200, sur:[
  ['Brambory loupané',900],['Mouka pšeničná hladká',250],['Bramborový škrob',60],['Vejce slepičí',50],
  ['Maso uzené (plec)',320],['Cibule',80],['Sádlo vepřové',20],['Sůl',10]] },

{ n:'Škubánky s mákem', k:'bezmasá', w:1000, sur:[
  ['Brambory loupané',800],['Mouka pšeničná hladká',200],['Máslo',60],['Mák mletý',80],
  ['Cukr moučka',60],['Sůl',8],['Voda pitná',300]] },

{ n:'Bramborové šišky s mákem', k:'bezmasá', w:1000, sur:[
  ['Brambory loupané',700],['Mouka pšeničná hladká',200],['Vejce slepičí',50],['Máslo',60],
  ['Mák mletý',80],['Cukr moučka',60],['Sůl',6]] },

{ n:'Nudle s mákem', k:'bezmasá', w:900, sur:[
  ['Těstoviny semolinové syrové',350],['Mák mletý',100],['Cukr moučka',80],['Máslo',60],['Sůl',5]] },

{ n:'Žemlovka s jablky', k:'bezmasá', w:1400, sur:[
  ['Houska',350],['Jablko',700],['Mléko plnotučné 3,5%',500],['Vejce slepičí',150],
  ['Cukr krystal',100],['Máslo',40],['Rozinky',60],['Vanilkový cukr',10]] },

{ n:'Dukátové buchtičky s krémem', k:'bezmasá', w:1300, sur:[
  ['Mouka pšeničná hladká',350],['Mléko plnotučné 3,5%',700],['Vejce slepičí',150],
  ['Cukr krystal',110],['Máslo',60],['Droždí čerstvé',20],['Bramborový škrob',30],
  ['Vanilkový cukr',10],['Sůl',3]] },

{ n:'Krupicová kaše s kakaem', k:'bezmasá', w:1100, sur:[
  ['Krupice pšeničná',150],['Mléko plnotučné 3,5%',900],['Cukr krystal',50],['Máslo',30],
  ['Kakao prášek neslazený',15],['Sůl',2]] },

{ n:'Rýžový nákyp s ovocem', k:'bezmasá', w:1300, sur:[
  ['Rýže bílá syrová',250],['Mléko plnotučné 3,5%',800],['Vejce slepičí',150],
  ['Cukr krystal',90],['Máslo',40],['Ovoce mražené směs',250],['Vanilkový cukr',10],['Sůl',2]] },

{ n:'Lívance', k:'bezmasá', w:850, sur:[
  ['Mouka pšeničná hladká',300],['Mléko plnotučné 3,5%',450],['Vejce slepičí',100],
  ['Droždí čerstvé',15],['Cukr krystal',30],['Máslo',50],['Sůl',3]] },

{ n:'Palačinky s marmeládou', k:'bezmasá', w:1000, sur:[
  ['Mouka pšeničná hladká',250],['Mléko plnotučné 3,5%',500],['Vejce slepičí',150],
  ['Máslo',50],['Marmeláda',200],['Cukr krystal',20],['Sůl',2]] },

{ n:'Bramborák', k:'bezmasá', w:800, sur:[
  ['Brambory loupané',1000],['Mouka pšeničná hladká',120],['Vejce slepičí',100],['Česnek',20],
  ['Mléko plnotučné 3,5%',80],['Olej řepkový',90],['Majoránka sušená',4],['Kmín celý',3],['Sůl',10]] },

{ n:'Zapečené těstoviny s uzeninou', k:'bezmasá', w:1500, sur:[
  ['Těstoviny semolinové syrové',350],['Salám gothaj',250],['Vejce slepičí',200],
  ['Mléko plnotučné 3,5%',200],['Eidam 30%',150],['Máslo',30],['Sůl',6]] },

{ n:'Bramborová kaše domácí', k:'bezmasá', w:1100, sur:[
  ['Brambory loupané',1000],['Mléko plnotučné 3,5%',200],['Máslo',60],['Sůl',9]] },

{ n:'Opékané brambory', k:'bezmasá', w:800, sur:[
  ['Brambory loupané',1000],['Sádlo vepřové',50],['Cibule',80],['Kmín celý',3],['Sůl',8]] },

/* ───────────── SALÁTY ───────────── */
{ n:'Bramborový salát s majonézou', k:'saláty', w:1500, sur:[
  ['Brambory loupané',800],['Mrkev',150],['Petržel kořen',80],['Okurka sterilovaná',200],
  ['Hrášek zelený',120],['Vejce slepičí',150],['Majonéza',250],['Hořčice plnotučná',30],
  ['Cibule',60],['Sůl',7]] },

{ n:'Vlašský salát', k:'saláty', w:1200, sur:[
  ['Salám gothaj',350],['Brambory',300],['Okurka sterilovaná',200],['Hrášek zelený',120],
  ['Vejce slepičí',100],['Majonéza',300],['Hořčice plnotučná',20],['Sůl',4]] },

{ n:'Pařížský salát', k:'saláty', w:1000, sur:[
  ['Šunka od kosti',350],['Okurka sterilovaná',150],['Vejce slepičí',150],['Hrášek zelený',100],
  ['Majonéza',280],['Hořčice plnotučná',20],['Sůl',3]] },

{ n:'Okurkový salát', k:'saláty', w:900, sur:[
  ['Okurka salátová',900],['Ocet kvasný 8%',40],['Cukr krystal',25],['Česnek',8],['Sůl',6]] },

{ n:'Zelný salát s mrkví', k:'saláty', w:900, sur:[
  ['Zelí bílé',700],['Mrkev',150],['Ocet kvasný 8%',35],['Cukr krystal',30],
  ['Olej řepkový',30],['Sůl',7],['Kmín celý',2]] },

{ n:'Rajčatový salát s cibulí', k:'saláty', w:950, sur:[
  ['Rajče',800],['Cibule',120],['Olej olivový',40],['Ocet kvasný 8%',20],['Sůl',5]] },

{ n:'Šopský salát', k:'saláty', w:1100, sur:[
  ['Rajče',450],['Okurka salátová',300],['Paprika červená',150],['Cibule',80],
  ['Balkánský sýr',150],['Olej olivový',40],['Ocet kvasný 8%',15],['Sůl',3]] },

{ n:'Míchaný zeleninový salát', k:'saláty', w:1000, sur:[
  ['Hlávkový salát',300],['Rajče',300],['Okurka salátová',250],['Paprika červená',150],
  ['Olej olivový',35],['Ocet kvasný 8%',15],['Sůl',4]] },

/* ───────────── POMAZÁNKY ───────────── */
{ n:'Vajíčková pomazánka', k:'pomazánky', w:740, sur:[
  ['Vejce slepičí',400],['Majonéza',240],['Hořčice plnotučná',25],['Cibule',80],
  ['Okurka sterilovaná',80],['Sůl',4]] },

{ n:'Česneková pomazánka', k:'pomazánky', w:650, sur:[
  ['Eidam 30%',250],['Majonéza',200],['Zakysaná smetana 15%',150],['Česnek',40],['Sůl',4]] },

{ n:'Tuňáková pomazánka', k:'pomazánky', w:700, sur:[
  ['Tuňák ve vlastní šťávě',300],['Tvaroh měkký odtučněný',250],['Majonéza',100],
  ['Cibule',60],['Citron',20],['Sůl',4]] },

{ n:'Sýrová pomazánka s křenem', k:'pomazánky', w:650, sur:[
  ['Tvaroh na strouhání',300],['Máslo',150],['Eidam 45%',150],['Křen čerstvý',40],['Sůl',3]] },

{ n:'Tvarohová pomazánka s pažitkou', k:'pomazánky', w:700, sur:[
  ['Tvaroh polotučný',450],['Zakysaná smetana 15%',180],['Cibule',50],['Máslo',30],['Sůl',5]] },

{ n:'Škvarková pomazánka', k:'pomazánky', w:600, sur:[
  ['Škvarky vepřové',300],['Sádlo vepřové',150],['Cibule',100],['Česnek',20],['Sůl',6],
  ['Majoránka sušená',3]] },

{ n:'Liptovská pomazánka', k:'pomazánky', w:580, sur:[
  ['Tvaroh na strouhání',300],['Máslo',180],['Cibule',80],['Paprika sladká mletá',10],
  ['Kmín celý',3],['Hořčice plnotučná',15],['Sůl',5]] },

{ n:'Játrová pomazánka', k:'pomazánky', w:620, sur:[
  ['Játra vepřová',450],['Máslo',150],['Cibule',100],['Hořčice plnotučná',20],['Sůl',5],
  ['Majoránka sušená',2]] },

/* ───────────── STUDENÁ KUCHYNĚ ───────────── */
{ n:'Utopenec', k:'studená kuchyně', w:600, sur:[
  ['Špekáčky',500],['Cibule',150],['Ocet kvasný 8%',120],['Okurka sterilovaná',80],
  ['Paprika červená',50],['Nové koření',2],['Bobkový list',1],['Sůl',3],['Voda pitná',200]] },

{ n:'Nakládaný hermelín', k:'studená kuchyně', w:620, odkap:140, sur:[
  ['Hermelín',480],['Olej řepkový',200],['Cibule',100],['Paprika červená',60],
  ['Česnek',15],['Paprika sladká mletá',6],['Nové koření',2]] },

{ n:'Obložený chlebíček', k:'studená kuchyně', w:600, sur:[
  ['Veka',200],['Bramborový salát s majonézou',200],['Šunka od kosti',80],['Vejce slepičí',60],
  ['Okurka sterilovaná',40],['Eidam 30%',40],['Rajče',30]] },

{ n:'Tatarský biftek', k:'studená kuchyně', w:600, sur:[
  ['Hovězí svíčková',500],['Vaječný žloutek',60],['Cibule',60],['Hořčice plnotučná',30],
  ['Kečup',30],['Sůl',5],['Pepř mletý',2]] },

/* ───────────── MOUČNÍKY ───────────── */
{ n:'Bublanina s ovocem', k:'moučníky', w:1200, sur:[
  ['Mouka pšeničná hladká',250],['Cukr krystal',200],['Vejce slepičí',200],['Máslo',120],
  ['Mléko plnotučné 3,5%',150],['Ovoce mražené směs',400],['Prášek do pečiva',10],
  ['Vanilkový cukr',10]] },

{ n:'Jablečný závin', k:'moučníky', w:1350, sur:[
  ['Mouka pšeničná hladká',300],['Jablko',800],['Cukr krystal',150],['Máslo',120],
  ['Rozinky',80],['Vlašské ořechy',60],['Strouhanka',60],['Vejce slepičí',50],['Sůl',3]] },

{ n:'Buchty s tvarohem', k:'moučníky', w:1400, sur:[
  ['Mouka pšeničná hladká',500],['Mléko plnotučné 3,5%',250],['Máslo',100],['Vejce slepičí',100],
  ['Cukr krystal',120],['Droždí čerstvé',30],['Tvaroh polotučný',400],['Rozinky',60],['Sůl',5]] },

{ n:'Makový koláč', k:'moučníky', w:1200, sur:[
  ['Mouka pšeničná hladká',450],['Mák mletý',250],['Cukr krystal',180],['Máslo',120],
  ['Mléko plnotučné 3,5%',250],['Vejce slepičí',100],['Droždí čerstvé',25],['Sůl',4]] },

{ n:'Medovník', k:'moučníky', w:1400, sur:[
  ['Mouka pšeničná hladká',400],['Med',150],['Cukr krystal',150],['Máslo',200],
  ['Vejce slepičí',100],['Zakysaná smetana 15%',400],['Cukr moučka',120],['Vlašské ořechy',60],
  ['Prášek do pečiva',8]] },

{ n:'Vanilkové rohlíčky', k:'moučníky', w:900, sur:[
  ['Mouka pšeničná hladká',350],['Máslo',250],['Mandle',150],['Cukr moučka',180],
  ['Vaječný žloutek',40],['Vanilkový cukr',20],['Sůl',2]] },

{ n:'Linecké cukroví', k:'moučníky', w:900, sur:[
  ['Mouka pšeničná hladká',400],['Máslo',250],['Cukr moučka',150],['Vaječný žloutek',40],
  ['Marmeláda',150],['Sůl',2]] },

{ n:'Piškotová roláda s marmeládou', k:'moučníky', w:800, sur:[
  ['Mouka pšeničná hladká',180],['Cukr krystal',180],['Vejce slepičí',250],['Marmeláda',250],
  ['Prášek do pečiva',5]] },

{ n:'Tvarohový nákyp', k:'moučníky', w:1100, sur:[
  ['Tvaroh polotučný',600],['Vejce slepičí',200],['Cukr krystal',120],['Krupice pšeničná',80],
  ['Rozinky',60],['Máslo',50],['Vanilkový cukr',10],['Sůl',2]] },

{ n:'Trdelník', k:'moučníky', w:900, sur:[
  ['Mouka pšeničná hladká',450],['Mléko plnotučné 3,5%',220],['Máslo',80],['Cukr krystal',150],
  ['Vejce slepičí',50],['Droždí čerstvé',25],['Vlašské ořechy',60],['Sůl',4]] },

{ n:'Perník s povidly', k:'moučníky', w:1000, sur:[
  ['Mouka pšeničná hladká',400],['Cukr krystal',180],['Med',80],['Vejce slepičí',100],
  ['Máslo',80],['Mléko plnotučné 3,5%',150],['Povidla švestková',150],['Kakao prášek neslazený',20],
  ['Prášek do pečiva',10]] },

{ n:'Ovocné knedlíky s tvarohem', k:'moučníky', w:1400, sur:[
  ['Mouka pšeničná hladká',400],['Tvaroh polotučný',250],['Vejce slepičí',100],
  ['Švestky',500],['Máslo',80],['Cukr moučka',80],['Tvaroh na strouhání',100],['Sůl',4]] }

];
