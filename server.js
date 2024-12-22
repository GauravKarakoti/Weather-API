const express=require("express");
const cheerio=require("cheerio");
const axios=require("axios");
const cors = require("cors");
require("dotenv").config();
const app=express();
app.use(cors());
app.get("/:city",async (req,res)=>{
    const page=await axios.get(process.env.SCRAPE_API_FIRST+req.params.city+process.env.SCRAPE_API_LAST);
    //console.log(page.data);
    const $=cheerio.load(page.data);
    const date=$(process.env.DATE_CLASS).text();
    const temperature=$(process.env.TEMPERATURE_CLASS).text();
    const minMaxTemperature=$(process.env.MIN_MAX_TEMPERATURE_CLASS).text();
    const humidityPressure=$(process.env.HUMIDITY_PRESSURE_CLASS).text();
    let minTemperature="";
    let maxTemperature="";
    let humidity="";
    let pressure="";
    for(let i=0;i<6;i++){
        if(i<3)
        {
            minTemperature+=minMaxTemperature[i];
        }
        else
        {
            maxTemperature+=minMaxTemperature[i];
        }
    }
    for(let i=0;i<6;i++){
        if(i<2)
        {
            humidity+=humidityPressure[i];
        }
        else
        {
            pressure+=humidityPressure[i];
        }
    }
    const weatherData={
        date,
        temperature,
        minTemperature,
        maxTemperature,
        humidity,
        pressure
    }
    res.send(weatherData);
    //console.log(req.params.city);
});
app.listen(process.env.PORT,()=>{
    console.log("Server started");
})