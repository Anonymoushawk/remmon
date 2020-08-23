function generateChart(elementId, title, yAxisName, unitString, chartData, range) {
    var cfg = {
        data: {
            datasets: [{
                label: title,
                backgroundColor: "#0C47EB",
                borderColor: "#0C47EB",
                data: chartData,
                type: "line",
                fill: false,
                pointRadius: 2,
                lineTension: 0,
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                xAxes: [{
                    display: true,
                    type: "time",
                    distribution: "linear",
                    // distribution: "series",
                    offset: true,
                    ticks: {
                        major: {
                            enabled: true,
                            fontStyle: "bold"
                        },
                        // source: "data",
                        source: "auto",
                        autoSkip: false,
                        maxRotation: 0,
                    },
                    time: {
                        unit: "minute",
                        stepSize: 5,
                        parser: "YYYY-MM-DD HH:mm:ss",
                        tooltipFormat: "HH:mm:ss DD.MM.YYYY",
                        displayFormats: {
                            // second: "HH:mm:ss",
                            minute: "HH:mm",
                            hour: "HH:mm"
                        }
                    }
                }],
                yAxes: [{
                    display: true,
                    gridLines: {
                        drawBorder: false
                    },
                    scaleLabel: {
                        display: true,
                        labelString: yAxisName
                    },
                    ticks: {
                        suggestedMin: range.min,
                        suggestedMax: range.max,
                        stepSize: range.step
                    }
                }]
            },
            tooltips: {
                intersect: false,
                mode: "index",
                callbacks: {
                    label: function (tooltipItem, myData) {
                        var label = myData.datasets[tooltipItem.datasetIndex].label || "";
                        if (label) {
                            label += ": ";
                        }
                        label += parseFloat(tooltipItem.value).toFixed(2) + " " + unitString;
                        return label;
                    }
                }
            }
        }
    };

    var ctx = document.getElementById(elementId).getContext("2d");
    ctx.canvas.width = 1000;
    ctx.canvas.height = 200;
    return new Chart(ctx, cfg);
}

function generatePieChart(elementId, title, yAxisName, unitString, labels, colors, chartData, maxValue) {
    var config = {
        type: "pie",
        data: {
            labels: labels,
            datasets: [{
                label: yAxisName,
                backgroundColor: colors,
                data: chartData
            }]
        },
        options: {
            title: {
                display: true,
                text: title
            },
            tooltips: {
                intersect: false,
                mode: "index",
                callbacks: {
                    label: function (tooltipItem, myData) {
                        var value = myData.datasets[0].data[tooltipItem.index];
                        var label = myData.labels[tooltipItem.index] + ": ";

                        var percent = value / maxValue * 100;

                        return label + value.toFixed(2) + " " + unitString + " (" + percent.toFixed(2) + "%)";
                    }
                }
            }
        }
    }
    return new Chart(document.getElementById(elementId), config);
}

function createDiv(id) {
    var divEl = document.createElement("div");
    document.getElementById("contentDiv").appendChild(divEl);
    divEl.id = id;
    divEl.classList = "chartDiv";
    return divEl;
}

function insertHeadline(text) {
    var hl = document.createElement("h1");
    hl.textContent = text;
    hl.classList = "statHL";
    document.getElementById("contentDiv").appendChild(hl);
}

function createDataHolder(id, text) {
    var el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    } else {
        var hl = document.createElement("h1");
        hl.id = id;
        hl.textContent = text;
        hl.classList = "statHL";
        document.getElementById("contentDiv").appendChild(hl);
    }
}

function createChartWrapper(id, classes, parent) {
    var target = parent || document.getElementById("contentDiv");

    var divEl = document.createElement("div");
    divEl.classList = classes;
    target.appendChild(divEl);
    var canvasEl = document.createElement("canvas");
    canvasEl.id = id;
    divEl.appendChild(canvasEl);
    return id;
}

function formatTimeDuration(seconds_) {
    var builder = "";

    var seconds = Math.floor(seconds_) % 60
    var minutes = Math.floor(seconds_ / 60) % 60
    var hours = Math.floor(seconds_ / 60 / 60) % 24
    var days = Math.floor(seconds_ / 60 / 60 / 24)

    if (days > 0) {
        builder += days + "d ";
    }
    if (hours > 0) {
        builder += hours + "h "
    }
    if (minutes > 0) {
        builder += minutes + "m ";
    }
    builder += seconds + "s";

    return builder;
}

class DataParser {

    constructor(jsonData) {
        console.log(jsonData);
        if (jsonData === undefined) {
            throw "No data";
        }
        this.dataObjects = JSON.parse(jsonData);
        this.ramStats = [];

        this.ramData = {};

        this.cpuStats = [];

        this.partitionStats = new Map();
        this.partitionData = new Map();

        this.download = [];
        this.upload = [];

        this.processCount = [];
        this.uptime = 0;
        this.valueCount = 0;

        this.parse();
    }

    parse() {
        const objects = this.dataObjects.length;
        if (objects === 0) {
            throw "No datasets";
        }

        this.valueCount = objects;

        for (var i = 0; i < objects; i++) {
            const dataObject = this.dataObjects[i];
            const unixTime = moment(dataObject.timestamp, "YYYY-MM-DD HH:mm:ss").valueOf();

            this.ramStats.push({ t: unixTime, y: dataObject.ram.used / 1024 });
            this.cpuStats.push({ t: unixTime, y: dataObject.cpu.utilization });

            this.processCount.push({ t: unixTime, y: dataObject.system.processes });

            this.download.push({ t: unixTime, y: this.byteToGB(dataObject.network.recv) });
            this.upload.push({ t: unixTime, y: this.byteToGB(dataObject.network.sent) });

            const parts = dataObject.partitions;
            for (var j = 0; j < parts.length; j++) {
                const part = parts[j];
                const pName = part.name;

                const pStats = this.partitionStats.has(pName) ? this.partitionStats.get(pName) : [];
                pStats.push({ t: unixTime, y: this.byteToGB(part.used) });
                this.partitionStats.set(pName, pStats);

                var pData = {};
                pData.data = [this.byteToGB(part.free), this.byteToGB(part.used)];
                pData.max = this.byteToGB(part.total);
                this.partitionData.set(pName, pData);
            }
        }

        const lastObject = this.dataObjects[objects - 1];

        this.ramData.data = [lastObject.ram.free / 1024, lastObject.ram.used / 1024];
        this.ramData.max = lastObject.ram.total / 1024;

        this.uptime = lastObject.system.uptime;
    }

    getRAMUsage() {
        return this.ramStats;
    }

    getRAMData() {
        return this.ramData;
    }

    getCPUStats() {
        return this.cpuStats;
    }

    getPartitionStats(name) {
        return this.partitionStats.get(name);
    }

    getPartitionData(name) {
        return this.partitionData.get(name);
    }

    getAllPartitionNames() {
        return Array.from(this.partitionStats.keys());
    }

    getDownload(){
        return this.download;
    }

    getUpload(){
        return this.upload;
    }

    getProcessCount(){
        return this.processCount;
    }

    getUptime(){
        return this.uptime;
    }

    getValueCount(){
        return this.valueCount;
    }

    byteToGB(bytes) {
        return bytes / 1024 / 1024 / 1024;
    }
}