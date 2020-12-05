const express = require('express')
const axios = require('axios')
const convert = require('xml-js')
const { MongoClient, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const app = express()
const port = 4000
app.listen(port)

app.use(express.static('public'))
app.use(express.json()) // application/json to object
app.use(express.urlencoded({ extended : true }) )

const clavePrivada = "Darth-Silvio"

////////////////// CONECTAR A LA DB ///////////////////
const ConnectionString = `mongodb+srv://ralsogaray:317maluz@nerdflix.scqvp.mongodb.net/catalogo?retryWrites=true&w=majority`


const ConnectionDB = async () => {
    
    const client = await MongoClient.connect(ConnectionString, { useUnifiedTopology : true })  //useUnifiedTopology --> es una propiedad que me va a permitir que los mismos métodos que puedo usar de manera generica con una base de datos MongoDb, me puedan servir para otras bases de datos NoSQL y que los metodos funcionen. El Cliente de mongoDB va funcionar en otras bases de datos NoSQL
    
    const db = await client.db('catalogo')

    return db;
}
///////////////////////////////////// 


const verifyToken = (request, response, next) => { 
    const { token} = request.query //extraigo el token que se llama "_auth" y lo deposito en _auth
    
    //jwt.verify(TOKEN, PALABRA-SECRETA, CALLBACK) <------ ANATOMIA PARA VERIFICAR TOKEN

    jwt.verify( token, clavePrivada, (error, data) =>{ //si el token es valido, en "data" esta la info encriptada en el token (naim, email y user id)
        if(error){
            response.end("ERROR: TOKEN EXPIRADO O INVALIDO!")
        } else{
            next() //con next() avanza para operar la funcion que sigue
        }
    })
}


// TRAYENDO LAS NOTICIAS Y SUBIENDO A LA DB!!
app.get('/agregarnoticias', async (req,res) => {
    const {data : noticias } = await axios.get('https://www.clarin.com/rss/lo-ultimo/')
    
    const resultado = convert.xml2json(noticias, {compact: true, spaces: 4})
    
    const hidratado = JSON.parse(resultado)
    
    const arrayNoticias = hidratado.rss.channel.item


    const noticiasMapeadas = arrayNoticias.map(noticia => {
        const objetoNoticia = {
            title       : noticia.title._cdata,
            description : noticia.description._cdata,
            source      : noticia.link._text,
            image       : noticia.enclosure._attributes.url,
            date        : noticia.pubDate._cdata
        }
        return objetoNoticia 
    })

    const db = await ConnectionDB() 

    const noticiasDB = await db.collection('noticias') 
    
    const { result } = await noticiasDB.insertMany( noticiasMapeadas ) 
    
    const { ok } = result // extraigo la propiedad "ok" del objeto result; si ok == 1 es que se subió correctamente la pelicula a la coleccion 
    
    const respuesta = {
        ok,
        msg: (ok == 1) ? "Pelicula guardada correctamente" : "Error al guardar la película" //<-- "operador ternario"; es un if mas ninja. Si ok == 1 retorna el primer mensaje, sino (else), el segundo
    }
    res.end(respuesta)
})
// TEST
app.get("/test", async (request, response) => { 
    try{   
        const db = await ConnectionDB()

        const noticias = await db.collection('noticias').find({}).toArray() //con toArray() me devuelve en forma de array las peliculas de la base de datos
    
        console.log(noticias)
    
        return response.json(noticias) //convierte de objeto a json() --> convierte de objeto a json y lo devuelve como respuesta a la peticion HTTP
    }catch(error){
        return response.json( {"ok" : false, "msg" : "Películas no encontrada :("} )
    }
})



app.get("/noticias", verifyToken, async (request, response) => { //verifyToken
    
    
    //const { token } = request.query
    //console.log(token)

    try{   
        const db = await ConnectionDB() 

        const noticiasDB = await db.collection('noticias').find({}).toArray()

        return response.json(noticiasDB) 
    }catch(error){
        return response.json( {"ok" : false, "msg" : "Noticias no encontradas :("} )
    }
})


app.get("/noticias/:id", verifyToken ,async (request, response) => { 

    const { id } = request.params  

    try{
        const db = await ConnectionDB() 
        const noticiasDB = await db.collection('noticias') 

        const busqueda = { "_id" : ObjectId( id ) } 

        const resultado = await noticiasDB.find( busqueda ).toArray() 

        return  response.json( {"ok" : true, resultado }) 

    } catch(error){
        
        return response.json( {"ok" : false, "msg" : "Noticia no encontrada :("} )
    }
})


//const token = jwt.sign(PAYLOAD, CONFIGS, secretKey ) <---- anatomia para ejecutar la funcion JWT

app.get("/auth",(req, res) =>{

    

    const usuario = {
        email : 'probando@eant.tech',
        pass : "eant1234",
    }

    const token = jwt.sign({ email: usuario.email, pass: usuario.pass, expiresIn : 60 * 600}, clavePrivada )


    res.end(token)
})

