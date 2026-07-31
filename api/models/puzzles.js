const mongoose = require("mongoose");

const puzzlesSchema = new mongoose.Schema(
	{
		imageUrl: {
			type: String,
			trim: true
		},
		difficulty: {
			type: String,
			required: true,
			enum: ["easy", "medium", "hard"]
		},
		imagefile: {
			type: String,
		},
		translations: {
			en: {
				title: {
					type: String,
					required: true,
					trim: true
				},
				description: {
					type: String,
					required: true,
					trim: true
				},
				explanation: {
					type: String,
					required: true,
					trim: true
				}
			},
			ml: {
				title: {
					type: String,
					trim: true
				},
				description: {
					type: String,
					trim: true
				},
				explanation: {
					type: String,
					trim: true
				}
			},
			hi: {
				title: {
					type: String,
					trim: true
				},
				description: {
					type: String,
					trim: true
				},
				explanation: {
					type: String,
					trim: true
				}
			},
			ur: {
				title: {
					type: String,
					trim: true
				},
				description: {
					type: String,
					trim: true
				},
				explanation: {
					type: String,
					trim: true
				}
			},
		},
		isActive: {
			type: String,
			enum: ["true", "false"],
			default: "true"
		}
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Puzzle", puzzlesSchema);