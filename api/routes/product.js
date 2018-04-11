const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const Product = require('../models/product');
const config = require('../../config');

const productFolder = './' + config.filePaths.product;
const moduleName = config.routeSlug.product;
let productImage = String;

/*  Possible Routes  */
const RequestUrl = function () {
    return {
        'list': {
            "url": config.baseUrl + moduleName,
            "method": "GET",
        },
        'details': {
            "url": config.baseUrl + moduleName,
            "method": "GET",
        },
        'create': {
            "url": config.baseUrl + moduleName,
            "method": "POST",
        },
        'update': {
            "url": config.baseUrl + moduleName,
            "method": "PUT",
        },
        'delete': {
            "url": config.baseUrl + moduleName,
            "method": "DELETE",
        },
    };
}

/* Upload File Preprations */
const storage = multer.diskStorage({
    destination: productFolder,
    filename: (request, file, callBack) => {
        productImage = new Date().toISOString() + file.originalname;
        callBack(null, productImage);
    }
})

const fileType = (request, file, callBack) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        callBack(null, true);
    } else {
        callBack(null, false);
    }
}

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 2
    },
    fileFilter: fileType
});


/* Route - Product Add */
router.post('/', upload.single('image'), (request, response, next) => {

    /* Check Product Name Duplication */
    Product.findOne({
        name: request.body.name
    })
        .exec()
        .then(result => {
            return new Promise((resolve, reject) => {
                if (result) {
                    /* Removed Product image if duplication found */
                    fs.unlink(productFolder + productImage);
                    reject({ message: 'Product with this name already present' });
                } else {
                    resolve();
                }
            })
        })
        .then(() => {
            /* Insert Product Records */
            const productSave = new Product({
                'name': request.body.name,
                'image': request.file.path,
                'description': request.body.description,
                'category': request.body.category
            });


            productSave.save()
                .then(result => {
                    let temRequestData = new RequestUrl();
                    temRequestData.details.url = temRequestData.details.url + '/' + result._id;


                    response.status(201)
                        .json({
                            message: 'Product added successfully',
                            requests: [{
                                'details': temRequestData.details
                            }]
                        })
                })
                .catch(error => {
                    response.status(500)
                        .json({
                            message: 'Error while adding Product',
                            Error: error
                        })
                });
        })
        .catch(err => {
            return response.status(500)
                .json({
                    error: err
                })
        });

});

/* Route - Get Specific Data using Id */
router.get('/:productID', (request, response, next) => {
    const id = request.params.productID;

    Product.findById({
            _id: id
        })
        .populate('category', 'name image description')
        .exec()
        .then(result => {
            return new Promise((resolve, reject) => {
                if (result === null) {
                    reject({ message: 'Can not found any Product with this ID' });
                } else {
                    resolve(result);
                }
            });
        })
        .then((result) => {
            let temRequestData = new RequestUrl();
            temRequestData.delete.url = temRequestData.delete.url + '/' + id;

            let responseData = {
                id: result._id,
                name: result.name,
                description: result.description,
                category: result.category,
                filePath: config.baseUrl + result.image
            };

            response.status(200)
                .json({
                    message: 'Result get successfully',
                    data: responseData,
                    requests: [{
                        'delete': temRequestData.delete
                    }]
                })
        })
        .catch(err => {
            if (err.name === 'CastError') {
                err = {
                    message: 'Inccorect Product ID, Please check'
                }
            }

            response.status(500)
                .json({
                    error: err
                })
        });
});

/* Route - Update Product */
router.put('/:productID', upload.single('image'), (request, response, next) => {
    const id = request.params.productID;

    Product.findOne({
        name: request.body.name
    })
        .exec()
        .then(result => {
            return new Promise((resolve, reject) => {
                if (result) {
                    reject({ message: 'Product already present with same name' });
                } else {
                    resolve();
                }
            });
        })
        .then(() => {
            /* Unlink Existing Image - If image upload */
            /* if(request.file != undefined){
                Product.findById(id)
                .then(result=>{
    
                })
                .catch();
            } */

            const productObj = {};

            for (tmp in request.body) {
                productObj[tmp] = request.body[tmp];
            }

            let updateCriteria = {
                _id: id
            }

            let updateData = {
                $set: productObj
            }

            Product.update(updateCriteria, updateData)
                .then(result => {
                    const temRequestData = new RequestUrl();
                    temRequestData.details.url = temRequestData.details.url + '/' + id;

                    response.status(200)
                        .json({
                            message: 'Product Update Successfully',
                            requests: [{
                                'details': temRequestData.details
                            }]
                        })
                })
                .catch(err => {
                    response.status(500)
                        .json({
                            error: err
                        })
                })
        })
        .catch(err => {
            response.status(500)
                .json({
                    error: err
                });
        });
});

/* Route - Getting All Produts */
router.get('/', (request, response, next) => {
    Product.find()
        .populate('category','name image description')
        .exec()
        .then(result => {
            let preparedData = result.map((tmpData) => {

                /* Add User Id to Url  */
                let tmpRequestData = new RequestUrl();
                tmpRequestData.details.url = tmpRequestData.details.url + '/' + tmpData._id;

                return {
                    _id: tmpData._id,
                    name: tmpData.name,
                    description: tmpData.description,
                    image: config.baseUrl + tmpData.image,
                    category: tmpData.category,
                    requests: [{
                        'details': tmpRequestData.details
                    }]
                }
            });

            let responseData = {
                count: preparedData.length,
                data: preparedData
            };

            response.status(200)
                .json({
                    message: 'Data get successfully',
                    data: responseData
                });
        })
        .catch(error => {
            response.status(500)
                .json({
                    Error: error
                });
        });
});

/* Route - Delete Product */
router.delete('/:productID', (request, response, next) => {
    const id = request.params.productID;

    Product.remove({ _id: id })
        .then(result => {
            response.status(200)
                .json({
                    message: 'Product Deleted Successfully'
                });
        })
        .catch(err => {
            response.status(500)
                .json({
                    error: err
                });
        });
});

module.exports = router;